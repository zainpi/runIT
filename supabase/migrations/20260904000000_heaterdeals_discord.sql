-- Optional Discord community access. OAuth states are short-lived and the
-- Discord access token is deliberately not persisted after the guild join.

create table if not exists public.heater_discord_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.heater_accounts(id) on delete cascade,
  discord_user_id text not null unique,
  username text not null,
  global_name text,
  avatar_hash text,
  guild_id text not null,
  membership_status text not null default 'member' check (membership_status in ('member', 'pending', 'not_member', 'unknown')),
  is_pending boolean not null default false,
  has_access_role boolean not null default false,
  access_granted boolean not null default false,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists heater_discord_links_guild_idx
  on public.heater_discord_links(guild_id, discord_user_id);

create table if not exists public.heater_discord_link_states (
  state_hash text primary key,
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists heater_discord_link_states_expiry_idx
  on public.heater_discord_link_states(expires_at, used_at);

alter table public.heater_discord_links enable row level security;
alter table public.heater_discord_link_states enable row level security;

revoke all on public.heater_discord_links from anon, authenticated;
revoke all on public.heater_discord_link_states from anon, authenticated;

grant usage on schema public to service_role;
grant all on public.heater_discord_links to service_role;
grant all on public.heater_discord_link_states to service_role;
