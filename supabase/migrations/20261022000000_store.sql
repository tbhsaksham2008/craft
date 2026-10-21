create extension if not exists pgcrypto;

create type public.product_category as enum ('ranks', 'coins', 'crates', 'bundles', 'cosmetics');
create type public.order_status as enum ('pending', 'paid', 'cancelled', 'refunded');
create type public.fulfillment_status as enum ('queued', 'processing', 'delivered', 'failed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  minecraft_username text check (minecraft_username is null or minecraft_username ~ '^[A-Za-z0-9_]{3,16}$'),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  name text not null check (length(name) between 1 and 120),
  category public.product_category not null,
  price_paise integer not null check (price_paise between 0 and 10000000),
  original_price_paise integer check (original_price_paise is null or original_price_paise between price_paise and 10000000),
  description text not null,
  perks text[] not null default '{}',
  image_key text not null default 'rank' check (image_key in ('rank', 'coins', 'crate')),
  featured boolean not null default false,
  enabled boolean not null default true,
  single boolean not null default false,
  tint text not null default 'sky' check (tint in ('sky', 'lilac', 'blush', 'lavender', 'primary')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  percent_off integer not null check (percent_off between 1 and 99),
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  minecraft_username text not null check (minecraft_username ~ '^[A-Za-z0-9_]{3,16}$'),
  status public.order_status not null default 'pending',
  currency char(3) not null default 'INR' check (currency = 'INR'),
  subtotal_paise integer not null check (subtotal_paise > 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  total_paise integer not null check (total_paise > 0 and total_paise = subtotal_paise - discount_paise),
  discount_code text,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id),
  name text not null,
  unit_price_paise integer not null check (unit_price_paise > 0),
  quantity integer not null check (quantity between 1 and 99),
  unique (order_id, product_id)
);

create table public.fulfillment_queue (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items (id) on delete cascade,
  status public.fulfillment_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index fulfillment_queue_status_created_idx on public.fulfillment_queue (status, created_at);

grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant select, insert, update, delete on public.discount_codes, public.fulfillment_queue to authenticated;
grant all on public.profiles, public.products, public.discount_codes, public.orders, public.order_items, public.fulfillment_queue to service_role;

insert into public.products (id, name, category, price_paise, original_price_paise, description, perks, image_key, featured, enabled, single, tint) values
  ('bee', 'Bee', 'ranks', 0, null, 'Permanent Bee rank perks and commands for Craft SMP.', array['[Bee] chat, TAB, and nametag tag', 'Bee Discord role', 'Yellow name and nametag', '5 sethomes', '10 player shops', '2 particle effects and styles', '4 chat emojis', '4 holograms with 2 lines each', '1 active particle', '1 glow color', '5 player warps', '12 shop stock pages', 'Colored player glow', 'Discord in-game messages', 'Keep inventory on death', '/feed, /sit, /craft, /loom, /nickname, /keepinv-on/off, /particles, /glow, /emojis', '32 Emeralds', '5 XP Levels'], 'rank', false, false, true, 'sky'),
  ('fox', 'Fox', 'ranks', 0, null, 'Permanent Fox rank perks and commands for Craft SMP.', array['[Fox] chat, TAB, and nametag tag', 'Fox Discord role', 'Orange name and nametag', '10 sethomes', '15 player shops', '6 particle effects and styles', '7 chat emojis', '8 holograms with 3 lines each', '1 active particle', '3 glow colors', '10 player warps', '15 shop stock pages', 'Colored or blinking player glow', 'Discord in-game messages', 'Keep inventory on death', 'Colorful signs with & and RGB colors', '/feed, /sit, /craft, /loom, /nickname, /keepinv-on/off, /particles, /glow, /emojis, /grindstone, /hat, /bellyflop, /disposal, /near, /unenchant', '64 Emeralds', '10 XP Levels'], 'rank', false, false, true, 'lilac'),
  ('parrot', 'Parrot', 'ranks', 0, null, 'Permanent Parrot rank perks and commands for Craft SMP.', array['[Parrot] chat, TAB, and nametag tag', 'Parrot Discord role', 'Pink name and nametag', '20 sethomes', '35 player shops', '12 particle effects and styles', '15 chat emojis', '14 holograms with 4 lines each', '2 active particles', '6 glow colors', '8 custom glow effects', '20 player warps', '20 shop stock pages', '10 land claim flags', 'Colored or blinking player glow', 'Change hologram text size', 'Discord in-game messages', 'Keep inventory and XP on death', 'Colored chat messages and signs', 'Warp visit notifications', 'Virtual player shop access', '/feed, /sit, /craft, /loom, /nickname, /keepinv-on/off, /particles, /glow, /emojis, /grindstone, /hat, /bellyflop, /disposal, /near, /unenchant, /setclaimflag, /smithingtable, /cartographytable, /heal, /thru, /enderchest, /crawl, /condense, /jump, /warpnotifyvisit-on|off', '5,000 Claim Blocks', '1 Diamond Key', '20 XP Levels'], 'rank', false, false, true, 'lavender'),
  ('wolf', 'Wolf', 'ranks', 0, null, 'Permanent Wolf rank perks and commands for Craft SMP.', array['[Wolf] chat, TAB, and nametag tag', 'Wolf Discord role', 'Blue name and nametag', 'Unlimited sethomes and player shops', 'All particle effects, styles, emojis, and glow colors', '20 holograms with 6 lines each', '3 active particles', '30 custom glow effects', '30 player warps', '25 shop stock pages', '42 land claim flags', 'Colored, blinking, or rainbow glow', 'Change hologram text size', 'Discord in-game messages', 'Land claims never expire', 'Keep inventory and XP on death', 'Colored chat and signs', 'Warp visit notifications', 'Spawner pickup with Silk Touch (12h cooldown)', 'Bypass random teleport cooldown', 'Virtual player shop access', '/feed, /itemname, /sit, /craft, /loom, /nickname, /keepinv-on/off, /particles, /glow, /emojis, /grindstone, /hat, /bellyflop, /disposal, /near, /unenchant, /setclaimflag, /smithingtable, /cartographytable, /heal, /thru, /enderchest, /crawl, /lay, /condense, /jump, /warpnotifyvisit-on|off, /tptoggle, /anvil, /stonecutter, /ptime, /firework, /beezooka, /skull, /repair, /seen', '8,000 Claim Blocks', '1 Emerald Key', '40 XP Levels'], 'rank', false, false, true, 'primary'),
  ('coins-500', '500 Coins', 'coins', 24800, null, 'Top up your balance with 500 coins to spend in /shop and the auction house.', array['Delivered to your balance', 'Works with /shop & /ah'], 'coins', false, true, false, 'sky'),
  ('coins-1000', '1,000 Coins', 'coins', 41400, null, 'Top up your balance with 1,000 coins to spend in /shop and the auction house.', array['Delivered to your balance', 'Works with /shop & /ah'], 'coins', false, true, false, 'primary'),
  ('coins-2500', '2,500 Coins', 'coins', 91200, null, 'Top up your balance with 2,500 coins to spend in /shop and the auction house.', array['Delivered to your balance', 'Works with /shop & /ah'], 'coins', true, true, false, 'lavender'),
  ('coins-5000', '5,000 Coins', 'coins', 165900, 207400, 'Top up your balance with 5,000 coins to spend in /shop and the auction house.', array['Delivered to your balance', 'Works with /shop & /ah'], 'coins', false, true, false, 'lilac'),
  ('crate-common', 'Common Crate Key', 'crates', 8200, null, 'Open a Common Crate at /warp crates for a chance at common loot.', array['1 key', 'Open at /warp crates'], 'crate', false, true, false, 'sky'),
  ('crate-rare', 'Rare Crate Key', 'crates', 16500, null, 'Open a Rare Crate at /warp crates for a chance at rare loot.', array['1 key', 'Open at /warp crates'], 'crate', false, true, false, 'primary'),
  ('crate-epic', 'Epic Crate Key', 'crates', 29000, null, 'Open an Epic Crate at /warp crates for a chance at epic loot.', array['1 key', 'Open at /warp crates'], 'crate', false, true, false, 'lilac'),
  ('crate-legendary', 'Legendary Crate Key', 'crates', 49700, null, 'Open a Legendary Crate at /warp crates for a chance at legendary loot.', array['1 key', 'Open at /warp crates'], 'crate', true, true, false, 'blush'),
  ('bundle-starter', 'Starter Key Bundle', 'bundles', 58000, 82600, 'A mix of keys to kickstart your adventure.', array['3 Common keys', '2 Rare keys', '1 Epic key'], 'crate', false, true, false, 'sky'),
  ('bundle-mythic', 'Mythic Key Bundle', 'bundles', 165900, 248200, 'Stacked with high-tier keys for serious loot hunters.', array['3 Epic keys', '3 Legendary keys'], 'crate', true, true, false, 'lilac'),
  ('cos-trail', 'Starlight Trail', 'cosmetics', 33100, null, 'A shimmering particle trail that follows your every step.', array['Permanent', 'Toggle with /trails'], 'rank', false, true, true, 'lavender'),
  ('cos-tag', 'Custom Chat Tag', 'cosmetics', 20700, null, 'Show off a custom tag next to your name in chat.', array['Up to 8 characters', 'Change once a month'], 'rank', false, true, true, 'blush');

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, minecraft_username)
  values (
    new.id,
    new.email,
    case
      when coalesce(new.raw_user_meta_data ->> 'minecraft_username', '') ~ '^[A-Za-z0-9_]{3,16}$'
      then new.raw_user_meta_data ->> 'minecraft_username'
      else null
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.validate_discount_code(p_code text)
returns table (code text, percent_off integer)
language sql
stable
security definer
set search_path = ''
as $$
  select d.code, d.percent_off
  from public.discount_codes d
  where d.code = upper(trim(p_code))
    and d.active
    and (d.starts_at is null or d.starts_at <= now())
    and (d.expires_at is null or d.expires_at > now());
$$;

create function public.complete_paid_order(p_order_id uuid, p_payment_id text)
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
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.complete_paid_order(uuid, text) to service_role;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.discount_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.fulfillment_queue enable row level security;

create policy "Customers read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Customers update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Admins manage profiles" on public.profiles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke update on public.profiles from authenticated;
grant update (minecraft_username, updated_at) on public.profiles to authenticated;

create policy "Anyone reads active products" on public.products
  for select to anon, authenticated using (enabled or (select public.is_admin()));
create policy "Admins manage products" on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins manage discount codes" on public.discount_codes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Customers read their own orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Customers read their order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin())))
  );
create policy "Admins read fulfillment queue" on public.fulfillment_queue
  for select to authenticated using ((select public.is_admin()));
create policy "Admins manage fulfillment queue" on public.fulfillment_queue
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant execute on function public.validate_discount_code(text) to anon, authenticated;
