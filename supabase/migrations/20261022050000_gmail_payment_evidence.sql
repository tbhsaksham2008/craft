create table public.gmail_payment_checkpoints (
  id boolean primary key default true check (id),
  history_id text not null,
  updated_at timestamptz not null default now()
);

create table public.gmail_payment_events (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  sender text,
  received_at timestamptz,
  transaction_id text,
  utr text,
  amount_paise integer check (amount_paise is null or amount_paise > 0),
  currency char(3) check (currency is null or currency = 'INR'),
  payment_status text not null
    check (payment_status in ('received', 'ambiguous')),
  dkim_pass boolean not null default false,
  authentication_result text,
  order_id_hint uuid,
  review_status text not null default 'manual_review'
    check (review_status in ('manual_review', 'reviewed', 'rejected')),
  review_reason text not null,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  admin_review_reason text,
  created_at timestamptz not null default now()
);

create index gmail_payment_events_review_idx
  on public.gmail_payment_events (review_status, received_at desc);
create index gmail_payment_events_reference_idx
  on public.gmail_payment_events (transaction_id, utr);

create table public.gmail_payment_transaction_references (
  normalized_reference text primary key,
  gmail_event_id uuid not null unique
    references public.gmail_payment_events (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.gmail_payment_checkpoints enable row level security;
alter table public.gmail_payment_events enable row level security;
alter table public.gmail_payment_transaction_references enable row level security;

create policy "Admins read Gmail payment evidence"
  on public.gmail_payment_events
  for select to authenticated
  using ((select public.is_admin()));

revoke all on public.gmail_payment_checkpoints from anon, authenticated;
revoke all on public.gmail_payment_events from anon, authenticated;
grant select on public.gmail_payment_events to authenticated;
revoke all on public.gmail_payment_transaction_references from anon, authenticated;
grant all on public.gmail_payment_checkpoints,
  public.gmail_payment_events,
  public.gmail_payment_transaction_references to service_role;

create function public.record_gmail_payment_event(
  p_gmail_message_id text,
  p_sender text,
  p_received_at timestamptz,
  p_transaction_id text,
  p_utr text,
  p_amount_paise integer,
  p_currency text,
  p_payment_status text,
  p_dkim_pass boolean,
  p_authentication_result text,
  p_order_id_hint uuid,
  p_review_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_reference text;
  v_inserted_reference text;
  v_previous_reference text;
  v_duplicate_reference boolean := false;
begin
  if p_gmail_message_id is null or length(p_gmail_message_id) > 256 then
    raise exception 'Invalid Gmail message ID';
  end if;
  if p_payment_status is null
    or p_payment_status not in ('received', 'ambiguous') then
    raise exception 'Invalid parsed payment status';
  end if;
  if p_amount_paise is not null and p_amount_paise <= 0 then
    raise exception 'Invalid parsed payment amount';
  end if;

  insert into public.gmail_payment_events (
    gmail_message_id, sender, received_at, transaction_id, utr,
    amount_paise, currency, payment_status, dkim_pass,
    authentication_result, order_id_hint, review_reason
  )
  values (
    p_gmail_message_id, p_sender, p_received_at, p_transaction_id, p_utr,
    p_amount_paise, p_currency, p_payment_status, coalesce(p_dkim_pass, false),
    left(p_authentication_result, 1000), p_order_id_hint,
    left(coalesce(p_review_reason, 'Requires manual review.'), 1000)
  )
  on conflict (gmail_message_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id
    from public.gmail_payment_events
    where gmail_message_id = p_gmail_message_id;
    return v_event_id;
  end if;

  foreach v_reference in array array[
    upper(trim(coalesce(p_transaction_id, ''))),
    upper(trim(coalesce(p_utr, '')))
  ]
  loop
    if v_reference <> '' and v_reference is distinct from v_previous_reference then
      v_inserted_reference := null;
      insert into public.gmail_payment_transaction_references (
        normalized_reference, gmail_event_id
      )
      values (v_reference, v_event_id)
      on conflict (normalized_reference) do nothing
      returning normalized_reference into v_inserted_reference;
      if v_inserted_reference is null then
        v_duplicate_reference := true;
      end if;
    end if;
    v_previous_reference := v_reference;
  end loop;

  if v_duplicate_reference then
    update public.gmail_payment_events
    set review_reason = left(
      review_reason || ' Duplicate transaction reference found in another email.',
      1000
    )
    where id = v_event_id;
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.record_gmail_payment_event(
  text, text, timestamptz, text, text, integer, text, text, boolean,
  text, uuid, text
) from public, anon, authenticated;
grant execute on function public.record_gmail_payment_event(
  text, text, timestamptz, text, text, integer, text, text, boolean,
  text, uuid, text
) to service_role;

create function public.review_gmail_payment_event(
  p_event_id uuid,
  p_decision text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.gmail_payment_events%rowtype;
  v_reason text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_decision is null or p_decision not in ('reviewed', 'rejected') then
    raise exception 'Invalid email review decision';
  end if;

  v_reason := nullif(trim(p_reason), '');
  if v_reason is null or length(v_reason) > 1000 then
    raise exception 'A review reason of at most 1000 characters is required';
  end if;

  select * into v_event
  from public.gmail_payment_events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'Gmail evidence not found';
  end if;
  if v_event.review_status <> 'manual_review' then
    return false;
  end if;

  update public.gmail_payment_events
  set review_status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_review_reason = v_reason
  where id = v_event.id;

  return true;
end;
$$;

revoke all on function public.review_gmail_payment_event(uuid, text, text)
  from public, anon;
grant execute on function public.review_gmail_payment_event(uuid, text, text)
  to authenticated;
