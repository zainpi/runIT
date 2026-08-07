-- HeaterDeals server-side data, entitlement, quota, and Keepa job state.
-- The API uses the Supabase service role; no client-facing policy is granted.

create extension if not exists pgcrypto;

create table if not exists public.heater_accounts (
  id uuid primary key default gen_random_uuid(),
  apple_sub text not null unique,
  app_account_token uuid not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.heater_entitlements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  product_id text not null,
  original_transaction_id text not null unique,
  transaction_id text unique,
  app_account_token uuid,
  environment text not null check (environment in ('Sandbox', 'Production')),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'billing_retry', 'grace_period')),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, product_id)
);

create index if not exists heater_entitlements_active_idx
  on public.heater_entitlements(account_id, product_id, status, expires_at);

create table if not exists public.heater_devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  app_attest_key_id text not null,
  environment text not null default 'production',
  assertion_counter bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(account_id, app_attest_key_id)
);

create table if not exists public.heater_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists heater_refresh_tokens_account_idx
  on public.heater_refresh_tokens(account_id, expires_at, revoked_at);

create table if not exists public.heater_apple_notifications (
  notification_uuid text primary key,
  notification_type text,
  received_at timestamptz not null default now()
);

create table if not exists public.heater_deals (
  id uuid primary key default gen_random_uuid(),
  asin text not null,
  marketplace text not null check (marketplace in ('us', 'ca', 'de', 'uk')),
  title text not null,
  category text not null default 'tech',
  current_price numeric(12, 2) not null,
  reference_price numeric(12, 2) not null default 0,
  average90_day_price numeric(12, 2) not null default 0,
  score integer not null default 0 check (score between 0 and 100),
  confidence integer not null default 0 check (confidence between 0 and 100),
  reasoning text not null default '',
  minutes_ago integer not null default 0,
  seller text not null default 'Amazon',
  seller_rating numeric(4, 2) not null default 0,
  is_fba boolean not null default false,
  is_prime boolean not null default false,
  status text not null default 'live' check (status in ('live', 'burnedOut')),
  icon_name text not null default 'flame.fill',
  price_history jsonb not null default '[]'::jsonb,
  offer_listing_id text,
  keepa_updated_at timestamptz,
  observed_at timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(asin, marketplace)
);

create index if not exists heater_deals_feed_idx
  on public.heater_deals(marketplace, status, score desc, observed_at desc);
create index if not exists heater_deals_filter_idx
  on public.heater_deals(marketplace, category, current_price, score, is_fba);

create table if not exists public.heater_deal_snapshots (
  id bigserial primary key,
  deal_id uuid not null references public.heater_deals(id) on delete cascade,
  current_price numeric(12, 2) not null,
  reference_price numeric(12, 2),
  score integer,
  captured_at timestamptz not null default now()
);

create index if not exists heater_deal_snapshots_idx
  on public.heater_deal_snapshots(deal_id, captured_at desc);

create table if not exists public.heater_alerts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  name text not null,
  categories text[] not null default '{}',
  min_discount integer not null default 30 check (min_discount between 0 and 100),
  min_price numeric(12, 2),
  max_price numeric(12, 2),
  marketplace text not null check (marketplace in ('us', 'ca', 'de', 'uk')),
  min_heat integer not null default 50 check (min_heat between 0 and 100),
  cadence text not null default 'instant' check (cadence in ('instant', 'batched', 'digest')),
  keyword text not null default '',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists heater_alerts_account_idx
  on public.heater_alerts(account_id, is_enabled);

create table if not exists public.heater_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.heater_idempotency_keys (
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  route text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  primary key(account_id, route, idempotency_key)
);

create table if not exists public.heater_sync_locks (
  lock_key text primary key,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Atomic fixed-window rate limiting. It is deliberately server-only and
-- returns Retry-After information to the API route.
create or replace function public.consume_heater_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_count integer;
  next_window timestamptz;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    return query select false, 0, p_window_seconds;
    return;
  end if;

  select window_started_at, request_count
    into current_window, current_count
    from public.heater_rate_limits
    where bucket_key = p_bucket_key
    for update;

  if current_window is null or current_window + make_interval(secs => p_window_seconds) <= now() then
    current_window := now();
    current_count := 1;
    insert into public.heater_rate_limits(bucket_key, window_started_at, request_count, updated_at)
      values (p_bucket_key, current_window, current_count, now())
    on conflict (bucket_key) do update set
      window_started_at = excluded.window_started_at,
      request_count = excluded.request_count,
      updated_at = now();
  else
    current_count := current_count + 1;
    update public.heater_rate_limits
      set request_count = current_count, updated_at = now()
      where bucket_key = p_bucket_key;
  end if;

  next_window := current_window + make_interval(secs => p_window_seconds);
  return query select
    current_count <= p_limit,
    greatest(0, p_limit - current_count),
    greatest(1, ceil(extract(epoch from (next_window - now())))::integer);
end;
$$;

create or replace function public.claim_heater_idempotency(
  p_account_id uuid,
  p_route text,
  p_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.heater_idempotency_keys(account_id, route, idempotency_key)
    values (p_account_id, p_route, p_idempotency_key)
    on conflict do nothing;
  return found;
end;
$$;

create or replace function public.claim_heater_sync_lock(
  p_lock_key text,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.heater_sync_locks(lock_key, locked_until, updated_at)
    values (p_lock_key, now() + make_interval(secs => p_ttl_seconds), now())
    on conflict (lock_key) do update set
      locked_until = excluded.locked_until,
      updated_at = now()
    where public.heater_sync_locks.locked_until <= now();
  return found;
end;
$$;

create or replace function public.release_heater_sync_lock(p_lock_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.heater_sync_locks where lock_key = p_lock_key;
$$;

alter table public.heater_accounts enable row level security;
alter table public.heater_entitlements enable row level security;
alter table public.heater_devices enable row level security;
alter table public.heater_refresh_tokens enable row level security;
alter table public.heater_apple_notifications enable row level security;
alter table public.heater_deals enable row level security;
alter table public.heater_deal_snapshots enable row level security;
alter table public.heater_alerts enable row level security;
alter table public.heater_rate_limits enable row level security;
alter table public.heater_idempotency_keys enable row level security;
alter table public.heater_sync_locks enable row level security;

revoke all on public.heater_accounts from anon, authenticated;
revoke all on public.heater_entitlements from anon, authenticated;
revoke all on public.heater_devices from anon, authenticated;
revoke all on public.heater_refresh_tokens from anon, authenticated;
revoke all on public.heater_apple_notifications from anon, authenticated;
revoke all on public.heater_deals from anon, authenticated;
revoke all on public.heater_deal_snapshots from anon, authenticated;
revoke all on public.heater_alerts from anon, authenticated;
revoke all on public.heater_rate_limits from anon, authenticated;
revoke all on public.heater_idempotency_keys from anon, authenticated;
revoke all on public.heater_sync_locks from anon, authenticated;

grant usage on schema public to service_role;
grant all on public.heater_accounts to service_role;
grant all on public.heater_entitlements to service_role;
grant all on public.heater_devices to service_role;
grant all on public.heater_refresh_tokens to service_role;
grant all on public.heater_apple_notifications to service_role;
grant all on public.heater_deals to service_role;
grant all on public.heater_deal_snapshots to service_role;
grant all on public.heater_alerts to service_role;
grant all on public.heater_rate_limits to service_role;
grant all on public.heater_idempotency_keys to service_role;
grant all on public.heater_sync_locks to service_role;
grant all on sequence public.heater_deal_snapshots_id_seq to service_role;
grant execute on function public.consume_heater_rate_limit(text, integer, integer) to service_role;
grant execute on function public.claim_heater_idempotency(uuid, text, text) to service_role;
grant execute on function public.claim_heater_sync_lock(text, integer) to service_role;
grant execute on function public.release_heater_sync_lock(text) to service_role;
