alter table public.orders
  add column if not exists expires_at timestamptz;

update public.orders
set expires_at = created_at + interval '30 minutes'
where expires_at is null;

alter table public.orders
  alter column expires_at set default (now() + interval '30 minutes'),
  alter column expires_at set not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'razorpay_order_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'legacy_razorpay_order_id'
  ) then
    alter table public.orders
      rename column razorpay_order_id to legacy_razorpay_order_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'razorpay_payment_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'legacy_razorpay_payment_id'
  ) then
    alter table public.orders
      rename column razorpay_payment_id to legacy_razorpay_payment_id;
  end if;
end;
$$;

drop function if exists public.complete_paid_order(uuid, text);

create table public.upi_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id),
  transaction_reference text check (
    transaction_reference is null
    or length(transaction_reference) between 1 and 128
  ),
  customer_note text check (
    customer_note is null or length(customer_note) <= 1000
  ),
  status text not null default 'submitted'
    check (status in ('submitted', 'manual_review', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_reason text check (
    review_reason is null or length(review_reason) <= 1000
  ),
  created_at timestamptz not null default now()
);

create index upi_payment_submissions_status_created_idx
  on public.upi_payment_submissions (status, created_at);
create index upi_payment_submissions_order_idx
  on public.upi_payment_submissions (order_id, created_at desc);
create unique index upi_payment_one_open_submission_per_order_idx
  on public.upi_payment_submissions (order_id)
  where status in ('submitted', 'manual_review');

create table public.upi_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id),
  submission_id uuid not null unique
    references public.upi_payment_submissions (id),
  transaction_reference text not null
    check (length(transaction_reference) between 1 and 128),
  amount_paise integer not null check (amount_paise > 0),
  settled_at timestamptz not null,
  currency char(3) not null default 'INR' check (currency = 'INR'),
  verification_source text not null default 'manual_bank_reconciliation'
    check (verification_source = 'manual_bank_reconciliation'),
  verified_by uuid not null references public.profiles (id),
  verified_at timestamptz not null default now()
);

create unique index upi_payment_transaction_reference_key
  on public.upi_payment_transactions (upper(trim(transaction_reference)));

create table public.upi_payment_review_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.upi_payment_submissions (id) on delete cascade,
  decision text not null check (
    decision in ('manual_review', 'approved', 'rejected')
  ),
  reviewer_id uuid not null references public.profiles (id),
  reason text not null check (length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index upi_payment_review_events_submission_idx
  on public.upi_payment_review_events (submission_id, created_at);

alter table public.upi_payment_submissions enable row level security;
alter table public.upi_payment_transactions enable row level security;
alter table public.upi_payment_review_events enable row level security;

create policy "Customers read their own UPI submissions"
  on public.upi_payment_submissions
  for select to authenticated
  using (
    submitted_by = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Admins read UPI transactions"
  on public.upi_payment_transactions
  for select to authenticated
  using ((select public.is_admin()));

create policy "Admins read UPI review events"
  on public.upi_payment_review_events
  for select to authenticated
  using ((select public.is_admin()));

revoke all on public.upi_payment_submissions from anon, authenticated;
grant select on public.upi_payment_submissions to authenticated;
revoke all on public.upi_payment_transactions from anon, authenticated;
grant select on public.upi_payment_transactions to authenticated;
revoke all on public.upi_payment_review_events from anon, authenticated;
grant select on public.upi_payment_review_events to authenticated;
grant all on public.upi_payment_submissions,
  public.upi_payment_transactions,
  public.upi_payment_review_events to service_role;

create function public.submit_upi_payment(
  p_order_id uuid,
  p_transaction_reference text default null,
  p_customer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_submission_id uuid;
  v_reference text;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before submitting payment details';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Order is no longer pending';
  end if;
  v_reference := nullif(trim(p_transaction_reference), '');
  v_note := nullif(trim(p_customer_note), '');
  if v_reference is not null and length(v_reference) > 128 then
    raise exception 'Transaction reference is too long';
  end if;
  if v_note is not null and length(v_note) > 1000 then
    raise exception 'Payment note is too long';
  end if;

  insert into public.upi_payment_submissions (
    order_id, submitted_by, transaction_reference, customer_note
  )
  values (v_order.id, auth.uid(), v_reference, v_note)
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

revoke all on function public.submit_upi_payment(uuid, text, text)
  from public, anon;
grant execute on function public.submit_upi_payment(uuid, text, text)
  to authenticated;

create function public.review_upi_payment_submission(
  p_submission_id uuid,
  p_decision text,
  p_verified_amount_paise integer default null,
  p_verified_transaction_reference text default null,
  p_settled_at timestamptz default null,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.upi_payment_submissions%rowtype;
  v_order public.orders%rowtype;
  v_reference text;
  v_reason text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_decision is null
    or p_decision not in ('manual_review', 'approved', 'rejected') then
    raise exception 'Invalid payment review decision';
  end if;

  v_reason := nullif(trim(p_reason), '');
  if v_reason is null or length(v_reason) > 1000 then
    raise exception 'A review reason of at most 1000 characters is required';
  end if;

  select * into v_submission
  from public.upi_payment_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Payment submission not found';
  end if;
  if v_submission.status not in ('submitted', 'manual_review') then
    return false;
  end if;

  select * into v_order
  from public.orders
  where id = v_submission.order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if p_decision = 'approved' then
    if v_order.status <> 'pending' then
      raise exception 'Order is no longer pending';
    end if;
    if p_verified_amount_paise is distinct from v_order.total_paise then
      raise exception 'Independently verified amount does not match the order';
    end if;
    if p_settled_at is null
      or p_settled_at < v_order.created_at
      or p_settled_at > v_order.expires_at
      or p_settled_at > now() then
      raise exception 'Verified settlement time must be during the active order window';
    end if;

    v_reference := nullif(upper(trim(p_verified_transaction_reference)), '');
    if v_reference is null or length(v_reference) > 128 then
      raise exception 'An independently verified transaction reference is required';
    end if;
    if exists (
      select 1
      from public.upi_payment_transactions t
      where upper(trim(t.transaction_reference)) = v_reference
    ) then
      raise exception 'Transaction reference has already been used';
    end if;

    insert into public.upi_payment_transactions (
      order_id, submission_id, transaction_reference, amount_paise,
      settled_at, verification_source, verified_by
    )
    values (
      v_order.id, v_submission.id, v_reference, p_verified_amount_paise,
      p_settled_at, 'manual_bank_reconciliation', auth.uid()
    );

    update public.orders
    set status = 'paid', paid_at = now()
    where id = v_order.id;

    insert into public.fulfillment_queue (order_item_id)
    select id
    from public.order_items
    where order_id = v_order.id
    on conflict (order_item_id) do nothing;
  end if;

  update public.upi_payment_submissions
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_reason = v_reason
  where id = v_submission.id;

  insert into public.upi_payment_review_events (
    submission_id, decision, reviewer_id, reason
  )
  values (v_submission.id, p_decision, auth.uid(), v_reason);

  return true;
end;
$$;

revoke all on function public.review_upi_payment_submission(
  uuid, text, integer, text, timestamptz, text
) from public, anon;
grant execute on function public.review_upi_payment_submission(
  uuid, text, integer, text, timestamptz, text
) to authenticated;
