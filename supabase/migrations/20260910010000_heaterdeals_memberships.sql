-- One membership across Apple and paid Discord. App-granted Discord roles never grant app entitlement.
alter table public.heater_accounts add column if not exists primary_marketplace text
  check (primary_marketplace in ('us','ca','de','uk'));
alter table public.heater_discord_links add column if not exists paid_tier text check (paid_tier in ('standard','pro'));
alter table public.heater_discord_links add column if not exists paid_access_expires_at timestamptz;
alter table public.heater_discord_links add column if not exists membership_checked_at timestamptz;
create table public.heater_product_tiers (
  product_id text primary key, tier text not null check (tier in ('standard','pro'))
);
insert into public.heater_product_tiers values
  ('com.pulsedeals.subscription.weekly','standard'),
  ('com.pulsedeals.subscription.monthly','pro'); -- Preserve legacy multi-country access.
alter table public.heater_product_tiers enable row level security;
revoke all on public.heater_product_tiers from anon, authenticated;
grant all on public.heater_product_tiers to service_role;

create or replace function public.heater_membership(p_account_id uuid)
returns table(tier text, source text, primary_marketplace text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  with grants as (
    select p.tier, 'apple'::text source, e.expires_at from heater_entitlements e
      join heater_product_tiers p using (product_id)
      where e.account_id=p_account_id and e.status in ('active','grace_period')
        and e.revoked_at is null and e.expires_at > now()
    union all
    select d.paid_tier, 'discord'::text, d.paid_access_expires_at from heater_discord_links d
      where d.account_id=p_account_id and d.paid_tier is not null
        and d.paid_access_expires_at > now() and d.membership_status='member' and not d.is_pending
  )
  select coalesce(g.tier,'none'), coalesce(g.source,'none'), a.primary_marketplace, g.expires_at
    from heater_accounts a left join lateral (
      select * from grants order by (tier='pro') desc, (source='apple') desc, expires_at desc limit 1
    ) g on true where a.id=p_account_id;
$$;
revoke execute on function public.heater_membership(uuid) from public, anon, authenticated;
grant execute on function public.heater_membership(uuid) to service_role;

-- Lock the first country atomically, including simultaneous claims from two devices.
create or replace function public.claim_heater_marketplace(p_account_id uuid, p_marketplace text)
returns void language plpgsql security definer set search_path=public as $$
declare current_market text; current_tier text;
begin
  if p_marketplace not in ('us','ca','de','uk') or p_marketplace is null then raise exception 'Invalid marketplace'; end if;
  select a.primary_marketplace into current_market from heater_accounts a where a.id=p_account_id for update;
  select m.tier into current_tier from heater_membership(p_account_id) m;
  if current_tier is null or current_tier='none' then raise exception 'Active subscription required'; end if;
  if current_market is not null and current_market<>p_marketplace then raise exception 'Your membership includes your selected country'; end if;
  update heater_accounts set primary_marketplace=p_marketplace where id=p_account_id and primary_marketplace is null;
end;
$$;
revoke execute on function public.claim_heater_marketplace(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_heater_marketplace(uuid,text) to service_role;

-- A subscription group can change product on upgrade/downgrade. Keep its original identity.
alter table public.heater_entitlements drop constraint if exists heater_entitlements_account_id_product_id_key;
alter table public.heater_entitlements add column if not exists signed_at bigint not null default 0;
create or replace function public.record_heater_apple_entitlement(p_account_id uuid, p_transaction jsonb, p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from heater_product_tiers where product_id=p_transaction->>'productId') then raise exception 'Invalid product'; end if;
  if exists(select 1 from heater_entitlements where original_transaction_id=p_transaction->>'originalTransactionId' and account_id<>p_account_id) then raise exception 'Transaction belongs to another account'; end if;
  insert into heater_entitlements(account_id,product_id,original_transaction_id,transaction_id,app_account_token,
    environment,status,expires_at,revoked_at,raw,signed_at)
  values(p_account_id,p_transaction->>'productId',p_transaction->>'originalTransactionId',p_transaction->>'transactionId',
    (p_transaction->>'appAccountToken')::uuid, p_transaction->>'environment',p_status,
    to_timestamp((p_transaction->>'expiresDate')::double precision/1000),
    to_timestamp((p_transaction->>'revocationDate')::double precision/1000),p_transaction,
    coalesce((p_transaction->>'signedDate')::bigint,0))
  on conflict(original_transaction_id) do update set product_id=excluded.product_id, transaction_id=excluded.transaction_id,
    status=excluded.status, expires_at=excluded.expires_at, revoked_at=excluded.revoked_at, raw=excluded.raw,
    signed_at=excluded.signed_at, last_verified_at=now(), updated_at=now()
    where heater_entitlements.account_id=excluded.account_id and heater_entitlements.signed_at<=excluded.signed_at;
end;
$$;
revoke execute on function public.record_heater_apple_entitlement(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.record_heater_apple_entitlement(uuid,jsonb,text) to service_role;

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
      and exists (select 1 from heater_membership(a.account_id) m
                  where m.tier='pro' or (m.tier='standard' and m.primary_marketplace=d.marketplace))
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
