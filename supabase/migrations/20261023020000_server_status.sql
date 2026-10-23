create table if not exists public.server_status (
  id text primary key check (id = 'main'),
  online boolean not null,
  online_players integer not null check (online_players >= 0),
  max_players integer not null check (max_players >= 0),
  updated_at timestamptz not null default now(),
  constraint server_status_player_count_valid
    check (online_players <= max_players)
);

alter table public.server_status enable row level security;

grant select on public.server_status to anon, authenticated;

create policy "Anyone can read server status"
  on public.server_status
  for select
  to anon, authenticated
  using (id = 'main');
