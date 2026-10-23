create table if not exists public.voting_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  url text not null check (url ~* '^https?://[^[:space:]]+$'),
  description text not null default '' check (char_length(description) <= 240),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.voting_sites enable row level security;

grant select on public.voting_sites to anon, authenticated;
grant insert, update, delete on public.voting_sites to authenticated;

create policy "Anyone can read enabled voting sites"
  on public.voting_sites
  for select
  to anon, authenticated
  using (enabled);

create policy "Admins can manage voting sites"
  on public.voting_sites
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
