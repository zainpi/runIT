-- Additive notification infrastructure; service-role access only.
alter table public.heater_alerts add column if not exists client_id uuid;
alter table public.heater_alerts add column if not exists prime_only boolean not null default false;
alter table public.heater_alerts add column if not exists fba_only boolean not null default false;
create unique index if not exists heater_alerts_client_idx on public.heater_alerts(account_id, client_id);
alter table public.heater_deals add column if not exists image_url text;

create table if not exists public.heater_push_devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  token text not null,
  environment text not null check (environment in ('sandbox','production')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(token, environment)
);
create index if not exists heater_push_devices_account_idx on public.heater_push_devices(account_id) where enabled;

create table if not exists public.heater_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.heater_push_devices(id) on delete cascade,
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  alert_id uuid not null references public.heater_alerts(id) on delete cascade,
  deal_id uuid not null references public.heater_deals(id) on delete cascade,
  price numeric(12,2) not null,
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','sending','sent','cancelled','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  unique(device_id, deal_id, price)
);
create index if not exists heater_push_deliveries_pending_idx on public.heater_push_deliveries(state, next_attempt_at);
create index if not exists heater_push_deliveries_cadence_idx on public.heater_push_deliveries(device_id, alert_id, created_at desc);

create or replace function public.claim_heater_push_deliveries(p_limit integer default 20)
returns setof public.heater_push_deliveries language sql security definer set search_path = public as $$
  update heater_push_deliveries set state = 'sending', attempts = attempts + 1,
    lease_until = now() + interval '2 minutes', lease_token = gen_random_uuid()
  where id in (
    select id from heater_push_deliveries
    where ((state = 'pending' and next_attempt_at <= now()) or (state = 'sending' and lease_until < now()))
      and expires_at > now() and attempts < 5
    order by created_at for update skip locked limit least(greatest(p_limit,1),50)
  ) returning *;
$$;
alter table public.heater_push_devices enable row level security;
alter table public.heater_push_deliveries enable row level security;
revoke all on public.heater_push_devices, public.heater_push_deliveries from anon, authenticated;
grant all on public.heater_push_devices, public.heater_push_deliveries to service_role;
revoke execute on function public.claim_heater_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_heater_push_deliveries(integer) to service_role;

-- The sync cron enqueues matches atomically. Duplicate prices and overlapping rules
-- produce one notification per device; non-instant rules choose their best match.
create or replace function public.enqueue_heater_push_matches(p_marketplace text, p_product_id text)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
  with candidates as (
    select d.id as deal_id, d.current_price, d.title, d.asin, d.marketplace, d.reference_price,
      d.observed_at, a.id as alert_id, a.cadence, a.account_id, v.id as device_id,
      row_number() over (partition by v.id, a.id order by d.score desc, d.observed_at desc, d.id) as rank
    from heater_alerts a
    join heater_push_devices v on v.account_id = a.account_id and v.enabled
    join heater_deals d on d.marketplace = a.marketplace
    where a.is_enabled and d.marketplace = p_marketplace and d.status = 'live'
      and d.observed_at > now() - interval '25 minutes'
      and d.current_price > 0 and d.reference_price > d.current_price
      and (cardinality(a.categories) = 0 or d.category = any(a.categories))
      and round((d.reference_price - d.current_price) / nullif(d.reference_price, 0) * 100) >= a.min_discount
      and d.score >= a.min_heat
      and (a.min_price is null or d.current_price >= a.min_price)
      and (a.max_price is null or d.current_price <= a.max_price)
      and (not a.prime_only or d.is_prime) and (not a.fba_only or d.is_fba)
      and not exists (select 1 from regexp_split_to_table(trim(a.keyword), '\s+') word
                      where word <> '' and strpos(lower(d.title || ' ' || d.category || ' ' || d.asin), lower(word)) = 0)
      and exists (select 1 from heater_entitlements e where e.account_id = a.account_id
                  and e.product_id = p_product_id and e.status in ('active','grace_period')
                  and e.revoked_at is null and e.expires_at > now())
      and not exists (select 1 from heater_push_deliveries prior where prior.device_id = v.id
                      and prior.deal_id = d.id and prior.price = d.current_price)
      and (a.cadence = 'instant' or not exists (
        select 1 from heater_push_deliveries prior where prior.device_id = v.id and prior.alert_id = a.id
          and prior.state in ('pending','sending','sent')
          and prior.created_at > now() - case a.cadence when 'digest' then interval '24 hours' else interval '6 hours' end
      ))
  )
  insert into heater_push_deliveries(device_id, account_id, alert_id, deal_id, price, payload, expires_at)
  select device_id, account_id, alert_id, deal_id, current_price,
    jsonb_build_object('asin', asin, 'marketplace', marketplace,
      'expiresAt', to_char((observed_at + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'aps', jsonb_build_object('category','PULSE_DEAL','sound','default','thread-id','deals-' || marketplace,
        'alert',jsonb_build_object(
          'title', case marketplace when 'us' then '$' when 'ca' then 'CA$' when 'uk' then '£' else '€' end ||
            current_price::text || ' · ' || round((reference_price-current_price)/nullif(reference_price,0)*100)::text || '% off',
          'body', title))), observed_at + interval '1 hour'
  from candidates where rank <= case cadence when 'instant' then 10 else 1 end
  on conflict(device_id, deal_id, price) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke execute on function public.enqueue_heater_push_matches(text,text) from public, anon, authenticated;
grant execute on function public.enqueue_heater_push_matches(text,text) to service_role;
