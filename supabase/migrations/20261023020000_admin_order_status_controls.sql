alter type public.order_status add value if not exists 'rejected';

drop function if exists public.submit_upi_payment(uuid, text, text);
drop function if exists public.review_upi_payment_submission(
  uuid, text, integer, text, timestamptz, text
);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  previous_status public.order_status not null,
  new_status public.order_status not null,
  changed_by uuid not null references public.profiles (id),
  changed_at timestamptz not null default now()
);

create index order_status_events_order_idx
  on public.order_status_events (order_id, changed_at desc);

alter table public.order_status_events enable row level security;

create policy "Admins read order status events"
  on public.order_status_events
  for select to authenticated
  using ((select public.is_admin()));

revoke all on public.order_status_events from anon, authenticated;
grant select on public.order_status_events to authenticated;
grant all on public.order_status_events to service_role;

create function public.set_admin_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_status is null then
    raise exception 'Order status is required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status = p_status then
    return false;
  end if;

  update public.orders
  set status = p_status,
      paid_at = case
        when p_status = 'paid' then coalesce(paid_at, now())
        else paid_at
      end
  where id = p_order_id;

  if p_status = 'paid' then
    insert into public.fulfillment_queue (order_item_id)
    select id
    from public.order_items
    where order_id = p_order_id
    on conflict (order_item_id) do update
      set status = 'queued',
          attempts = 0,
          last_error = null,
          updated_at = now()
      where fulfillment_queue.status = 'failed';
  elsif v_order.status = 'paid' then
    update public.fulfillment_queue
    set status = 'failed',
        last_error = 'Order status changed to ' || p_status::text,
        updated_at = now()
    where order_item_id in (
      select id from public.order_items where order_id = p_order_id
    )
      and status = 'queued';
  end if;

  insert into public.order_status_events (
    order_id, previous_status, new_status, changed_by
  )
  values (p_order_id, v_order.status, p_status, auth.uid());

  return true;
end;
$$;

revoke all on function public.set_admin_order_status(
  uuid, public.order_status
) from public, anon;
grant execute on function public.set_admin_order_status(
  uuid, public.order_status
) to authenticated;
