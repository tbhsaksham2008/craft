alter table public.upi_payment_transactions
  alter column submission_id drop not null,
  alter column verified_by drop not null,
  add column gmail_event_id uuid
    references public.gmail_payment_events (id);

alter table public.upi_payment_transactions
  drop constraint if exists upi_payment_transactions_verification_source_check;

alter table public.gmail_payment_events
  add column sender_auth_pass boolean not null default false;

alter table public.upi_payment_transactions
  add constraint upi_payment_transactions_verification_source_check
    check (
      (
        verification_source = 'manual_bank_reconciliation'
        and submission_id is not null
        and verified_by is not null
        and gmail_event_id is null
      )
      or (
        verification_source = 'gmail_notification_exact_order_match'
        and submission_id is null
        and verified_by is null
        and gmail_event_id is not null
      )
    );

create unique index upi_payment_transactions_gmail_event_id_key
  on public.upi_payment_transactions (gmail_event_id)
  where gmail_event_id is not null;

create or replace function public.auto_approve_gmail_payment_event(
  p_event_id uuid,
  p_expected_sender text,
  p_sender_authenticated boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.gmail_payment_events%rowtype;
  v_order public.orders%rowtype;
  v_reference text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role access required';
  end if;

  if p_sender_authenticated is not true
    or nullif(trim(p_expected_sender), '') is null then
    return false;
  end if;

  select * into v_event
  from public.gmail_payment_events
  where id = p_event_id
  for update;

  if not found or v_event.review_status <> 'manual_review' then
    return false;
  end if;

  update public.gmail_payment_events
  set sender_auth_pass = coalesce(p_sender_authenticated, false)
  where id = v_event.id;

  if lower(trim(coalesce(v_event.sender, '')))
    <> lower(trim(p_expected_sender))
    or v_event.payment_status <> 'received'
    or v_event.currency is distinct from 'INR'
    or v_event.amount_paise is null
    or v_event.order_id_hint is null
    or v_event.received_at is null then
    return false;
  end if;

  v_reference := coalesce(
    nullif(upper(trim(v_event.transaction_id)), ''),
    nullif(upper(trim(v_event.utr)), '')
  );
  if v_reference is null
    or (
      nullif(trim(coalesce(v_event.transaction_id, '')), '') is null
      and nullif(trim(coalesce(v_event.utr, '')), '') is null
    ) then
    return false;
  end if;

  if exists (
    select 1
    from (
      values
        (nullif(upper(trim(coalesce(v_event.transaction_id, ''))), '')),
        (nullif(upper(trim(coalesce(v_event.utr, ''))), ''))
    ) as refs(normalized_reference)
    where refs.normalized_reference is not null
      and not exists (
        select 1
        from public.gmail_payment_transaction_references r
        where r.normalized_reference = refs.normalized_reference
          and r.gmail_event_id = v_event.id
      )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from (
      values
        (nullif(upper(trim(coalesce(v_event.transaction_id, ''))), '')),
        (nullif(upper(trim(coalesce(v_event.utr, ''))), ''))
    ) as refs(normalized_reference)
    join public.upi_payment_transactions t
      on upper(trim(t.transaction_reference)) = refs.normalized_reference
    where refs.normalized_reference is not null
  ) then
    return false;
  end if;

  select * into v_order
  from public.orders
  where id = v_event.order_id_hint
  for update;

  if not found
    or v_order.status <> 'pending'
    or v_order.total_paise <> v_event.amount_paise
    or v_event.received_at < v_order.created_at
    or v_event.received_at > v_order.expires_at
    or v_event.received_at > now() then
    return false;
  end if;

  insert into public.upi_payment_transactions (
    order_id,
    submission_id,
    transaction_reference,
    amount_paise,
    settled_at,
    verification_source,
    verified_by,
    gmail_event_id
  )
  values (
    v_order.id,
    null,
    v_reference,
    v_order.total_paise,
    v_event.received_at,
    'gmail_notification_exact_order_match',
    null,
    v_event.id
  );

  update public.orders
  set status = 'paid', paid_at = now()
  where id = v_order.id;

  insert into public.fulfillment_queue (order_item_id)
  select id
  from public.order_items
  where order_id = v_order.id
  on conflict (order_item_id) do nothing;

  update public.gmail_payment_events
  set review_status = 'reviewed',
      reviewed_at = now(),
      admin_review_reason =
        'Automatically accepted: authenticated sender, explicit order ID, exact amount, unique transaction reference, and received-payment status matched.'
  where id = v_event.id;

  return true;
end;
$$;

revoke all on function public.auto_approve_gmail_payment_event(
  uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.auto_approve_gmail_payment_event(
  uuid, text, boolean
) to service_role;
