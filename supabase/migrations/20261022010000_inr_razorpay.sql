do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'price_cents'
  ) then
    alter table public.products drop constraint if exists products_price_cents_check;
    alter table public.products drop constraint if exists products_original_price_cents_check;
    alter table public.products rename column price_cents to price_paise;
    alter table public.products rename column original_price_cents to original_price_paise;
    update public.products
    set price_paise = round(price_paise / 100.0 * 83) * 100,
        original_price_paise = case
          when original_price_paise is null then null
          else round(original_price_paise / 100.0 * 83) * 100
        end;
    alter table public.products
      add constraint products_price_paise_check check (price_paise between 1 and 10000000),
      add constraint products_original_price_paise_check check (
        original_price_paise is null or original_price_paise between price_paise and 10000000
      );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'unit_price_cents'
  ) then
    alter table public.order_items rename column unit_price_cents to unit_price_paise;
    update public.order_items
    set unit_price_paise = round(unit_price_paise / 100.0 * 83) * 100;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'total_cents'
  ) then
    alter table public.orders drop constraint if exists orders_currency_check;
    alter table public.orders drop constraint if exists orders_total_cents_check;
    alter table public.orders rename column subtotal_cents to subtotal_paise;
    alter table public.orders rename column discount_cents to discount_paise;
    alter table public.orders rename column total_cents to total_paise;

    update public.orders o
    set subtotal_paise = coalesce(
          (select sum(i.unit_price_paise * i.quantity)
           from public.order_items i
           where i.order_id = o.id),
          round(o.subtotal_paise / 100.0 * 83) * 100
        ),
        discount_paise = round(o.discount_paise / 100.0 * 83) * 100,
        currency = 'INR',
        status = case when o.status = 'pending' then 'cancelled'::public.order_status else o.status end;

    update public.orders
    set total_paise = subtotal_paise - discount_paise;

    alter table public.orders
      alter column currency set default 'INR',
      add constraint orders_currency_inr_check check (currency = 'INR'),
      add constraint orders_total_paise_check (
        total_paise > 0 and total_paise = subtotal_paise - discount_paise
      );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'paypal_order_id'
  ) then
    alter table public.orders rename column paypal_order_id to legacy_paypal_order_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'paypal_capture_id'
  ) then
    alter table public.orders rename column paypal_capture_id to legacy_paypal_capture_id;
  end if;

  alter table public.orders add column if not exists razorpay_order_id text;
  alter table public.orders add column if not exists razorpay_payment_id text;
  create unique index if not exists orders_razorpay_order_id_key on public.orders (razorpay_order_id);
  create unique index if not exists orders_razorpay_payment_id_key on public.orders (razorpay_payment_id);
end;
$$;

create or replace function public.complete_paid_order(p_order_id uuid, p_payment_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status = 'paid' then
    return false;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Order is not pending';
  end if;

  update public.orders
  set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now()
  where id = p_order_id;

  insert into public.fulfillment_queue (order_item_id)
  select id from public.order_items where order_id = p_order_id
  on conflict (order_item_id) do nothing;

  return true;
end;
$$;

revoke all on function public.complete_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_paid_order(uuid, text) to service_role;
