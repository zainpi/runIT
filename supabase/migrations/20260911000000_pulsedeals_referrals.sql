-- Referrals award a week of Apple subscription credit after a verified first trial.
-- Apple billing changes only through a signed promotional-offer purchase.
begin;

create table public.pulsedeals_referral_program (
  id boolean primary key default true check (id), started_at timestamptz not null default now()
);
insert into public.pulsedeals_referral_program default values;
create table public.pulsedeals_referral_codes (
  account_id uuid primary key references public.pulsedeals_accounts(id) on delete cascade,
  code text not null unique check (code ~ '^[A-F0-9]{12}$')
);
create table public.pulsedeals_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.pulsedeals_accounts(id) on delete set null,
  referred_id uuid unique references public.pulsedeals_accounts(id) on delete set null,
  code text not null,
  claimed_at timestamptz not null default now(),
  qualified_at timestamptz,
  revoked_at timestamptz,
  environment text check (environment in ('Sandbox','Production')),
  original_transaction_id text,
  transaction_id text,
  check (referrer_id <> referred_id),
  unique(environment, original_transaction_id)
);
create index pulsedeals_referrals_referrer on public.pulsedeals_referrals(referrer_id);
create table public.pulsedeals_referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.pulsedeals_referrals(id),
  account_id uuid references public.pulsedeals_accounts(id) on delete set null,
  product_id text not null references public.pulsedeals_product_tiers(product_id),
  environment text not null check (environment in ('Sandbox','Production')),
  original_transaction_id text not null,
  offer_id text not null default 'referral-week',
  nonce uuid not null default gen_random_uuid(),
  issued_at bigint not null,
  created_at timestamptz not null default now(),
  applied_transaction_id text,
  applied_at timestamptz,
  voided_at timestamptz,
  unique(environment, applied_transaction_id)
);
create unique index pulsedeals_one_pending_referral_redemption
  on public.pulsedeals_referral_redemptions(account_id) where applied_at is null and voided_at is null;

-- Retain signed transaction history so replays, renewals and out-of-order refunds
-- cannot award the same week again. Account deletion removes the account link.
create table public.pulsedeals_referral_transactions (
  environment text not null,
  transaction_id text not null,
  account_id uuid references public.pulsedeals_accounts(id) on delete set null,
  raw jsonb not null,
  primary key(environment, transaction_id)
);

create function public.redact_pulsedeals_referral_transaction() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.account_id is null then
    new.raw := jsonb_strip_nulls(jsonb_build_object('signedDate',new.raw->'signedDate','revocationDate',new.raw->'revocationDate'));
  end if;
  return new;
end $$;
create trigger pulsedeals_referral_transaction_redaction before update of account_id
  on public.pulsedeals_referral_transactions for each row when (new.account_id is null)
  execute function public.redact_pulsedeals_referral_transaction();

create function public.pulsedeals_referral_code(p_account_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare result text;
begin
  perform 1 from pulsedeals_accounts where id=p_account_id for update;
  if not found then raise exception 'Referral account missing'; end if;
  select code into result from pulsedeals_referral_codes where account_id=p_account_id;
  if result is not null then return result; end if;
  loop
    result := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
    insert into pulsedeals_referral_codes(account_id,code) values(p_account_id,result) on conflict do nothing;
    if found then return result; end if;
  end loop;
end $$;

create function public.claim_pulsedeals_referral(p_account_id uuid,p_code text) returns void
language plpgsql security definer set search_path=public as $$
declare owner uuid; existing text; joined timestamptz;
begin
  p_code := upper(trim(p_code));
  select created_at into joined from pulsedeals_accounts where id=p_account_id for update;
  if not found then raise exception 'Referral account missing'; end if;
  select code into existing from pulsedeals_referrals where referred_id=p_account_id;
  if existing=p_code then return; end if; -- Network retry of the same claim is safe.
  if existing is not null then raise exception 'Referral already claimed'; end if;
  if joined < (select started_at from pulsedeals_referral_program)
    or exists(select 1 from pulsedeals_entitlements where account_id=p_account_id)
    or exists(select 1 from pulsedeals_referral_transactions where account_id=p_account_id)
    or exists(select 1 from pulsedeals_discord_links where account_id=p_account_id and paid_tier is not null)
  then raise exception 'Referral requires a new user before their first subscription'; end if;
  select account_id into owner from pulsedeals_referral_codes where code=p_code;
  if owner is null then raise exception 'Referral code not found'; end if;
  if owner=p_account_id then raise exception 'Referral cannot be your own code'; end if;
  insert into pulsedeals_referrals(referrer_id,referred_id,code) values(owner,p_account_id,p_code);
end $$;

-- Keep the existing entitlement writer, then wrap it in one transaction with
-- referral qualification/redemption. Both billing POSTs and Apple webhooks use it.
alter function public.record_pulsedeals_apple_entitlement(uuid,jsonb,text)
  rename to record_pulsedeals_apple_entitlement_base;
create function public.record_pulsedeals_apple_entitlement(p_account_id uuid,p_transaction jsonb,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare token uuid; joined timestamptz; prior jsonb; purchased timestamptz;
  r pulsedeals_referrals; redemption uuid;
begin
  select app_account_token,created_at into token,joined from pulsedeals_accounts where id=p_account_id for update;
  if token is null then raise exception 'Referral account missing'; end if;
  if p_transaction->>'appAccountToken' is not null and (p_transaction->>'appAccountToken')::uuid<>token
    then raise exception 'Transaction belongs to another account'; end if;
  if p_transaction->>'transactionId' is null or p_transaction->>'originalTransactionId' is null
    then raise exception 'Invalid transaction'; end if;
  perform record_pulsedeals_apple_entitlement_base(p_account_id,p_transaction,p_status);
  select raw into prior from pulsedeals_referral_transactions
    where environment=p_transaction->>'environment' and transaction_id=p_transaction->>'transactionId';
  -- Revocation is terminal for a referral even if an older active JWS is replayed.
  if prior is not null and ((prior->>'revocationDate') is not null
    or coalesce((prior->>'signedDate')::bigint,0)>coalesce((p_transaction->>'signedDate')::bigint,0)) then return; end if;
  insert into pulsedeals_referral_transactions(environment,transaction_id,account_id,raw)
    values(p_transaction->>'environment',p_transaction->>'transactionId',p_account_id,p_transaction)
    on conflict(environment,transaction_id) do update set raw=excluded.raw
      where pulsedeals_referral_transactions.account_id=excluded.account_id;

  if p_transaction->>'revocationDate' is not null then
    update pulsedeals_referrals set revoked_at=coalesce(revoked_at,now())
      where environment=p_transaction->>'environment' and transaction_id=p_transaction->>'transactionId';
    return;
  end if;
  purchased := to_timestamp((p_transaction->>'purchaseDate')::double precision/1000);
  select * into r from pulsedeals_referrals where referred_id=p_account_id for update;
  if r.id is not null and r.qualified_at is null and r.revoked_at is null
    and p_transaction->>'offerType'='1' and p_transaction->>'offerDiscountType'='FREE_TRIAL'
    and p_transaction->>'transactionReason'='PURCHASE' and p_transaction->>'inAppOwnershipType'='PURCHASED'
    and p_transaction->>'appAccountToken' is not null
    and (p_transaction->>'purchaseDate')::bigint=(p_transaction->>'originalPurchaseDate')::bigint
    and purchased>=r.claimed_at and purchased>=joined
    and to_timestamp((p_transaction->>'expiresDate')::double precision/1000)>purchased
  then
    update pulsedeals_referrals set qualified_at=now(), environment=p_transaction->>'environment',
      original_transaction_id=p_transaction->>'originalTransactionId',transaction_id=p_transaction->>'transactionId'
      where id=r.id;
  end if;

  -- A replay of an already applied offer cannot spend the next credit.
  if p_transaction->>'offerType'='2' and p_transaction->>'offerDiscountType'='FREE_TRIAL'
    and p_transaction->>'offerIdentifier'='referral-week'
    and p_transaction->>'inAppOwnershipType'='PURCHASED'
    and not exists(select 1 from pulsedeals_referral_redemptions
      where environment=p_transaction->>'environment' and applied_transaction_id=p_transaction->>'transactionId')
  then
    select id into redemption from pulsedeals_referral_redemptions where account_id=p_account_id and applied_at is null and voided_at is null
      and environment=p_transaction->>'environment' and product_id=p_transaction->>'productId'
      and p_transaction->>'appAccountToken' is not null
      and purchased>=created_at for update;
    update pulsedeals_referral_redemptions set applied_at=now(),applied_transaction_id=p_transaction->>'transactionId'
      where id=redemption;
  end if;
end $$;

create function public.reserve_pulsedeals_referral_week(p_account_id uuid,p_environment text)
returns pulsedeals_referral_redemptions language plpgsql security definer set search_path=public as $$
declare result pulsedeals_referral_redemptions; credit uuid; entitlement pulsedeals_entitlements;
begin
  perform 1 from pulsedeals_accounts where id=p_account_id for update;
  if exists(select 1 from pulsedeals_membership(p_account_id) where source='discord')
    then raise exception 'Referral credit cannot change Discord billing'; end if;
  select * into result from pulsedeals_referral_redemptions where account_id=p_account_id and applied_at is null and voided_at is null;
  if result.id is not null then return result; end if;
  select * into entitlement from pulsedeals_entitlements where account_id=p_account_id
    and environment=p_environment and revoked_at is null and status in ('active','expired')
    order by expires_at desc limit 1;
  if entitlement.id is null then raise exception 'Referral credit needs an Apple subscription'; end if;
  if exists(select 1 from pulsedeals_membership(p_account_id) where source='discord')
    then raise exception 'Referral credit cannot change Discord billing'; end if;
  select r.id into credit from pulsedeals_referrals r where r.referrer_id=p_account_id
    and r.environment=p_environment and r.qualified_at is not null and r.revoked_at is null
    and not exists(select 1 from pulsedeals_referral_redemptions d where d.referral_id=r.id)
    order by r.qualified_at,r.id limit 1 for update;
  if credit is null then raise exception 'Referral credit unavailable'; end if;
  insert into pulsedeals_referral_redemptions(referral_id,account_id,product_id,environment,original_transaction_id,issued_at)
    values(credit,p_account_id,entitlement.product_id,p_environment,entitlement.original_transaction_id,
      floor(extract(epoch from clock_timestamp())*1000)::bigint) returning * into result;
  return result;
end $$;

-- Only the server can authorize a retry, after checking Apple's complete history
-- AND signed renewal info for an already scheduled offer. Never trust cancellation
-- or pending status reported by a client to refund/reissue a signature.
create function public.retry_pulsedeals_referral_week(p_account_id uuid,p_id uuid,p_previous_issued_at bigint)
returns pulsedeals_referral_redemptions language plpgsql security definer set search_path=public as $$
declare result pulsedeals_referral_redemptions; latest pulsedeals_entitlements;
begin
  perform 1 from pulsedeals_accounts where id=p_account_id for update;
  if exists(select 1 from pulsedeals_membership(p_account_id) where source='discord')
    then raise exception 'Referral credit cannot change Discord billing'; end if;
  select * into result from pulsedeals_referral_redemptions where id=p_id and account_id=p_account_id for update;
  if result.id is null or result.applied_at is not null or result.voided_at is not null then raise exception 'Referral offer already applied'; end if;
  if result.issued_at<>p_previous_issued_at then raise exception 'Referral offer already issued'; end if;
  if result.issued_at>extract(epoch from now()-interval '25 hours')*1000
    then raise exception 'Referral offer awaiting Apple confirmation'; end if;
  if exists(select 1 from pulsedeals_referrals where id=result.referral_id and revoked_at is not null)
  then
    update pulsedeals_referral_redemptions set voided_at=now() where id=p_id returning * into result;
    return result;
  end if;
  select * into latest from pulsedeals_entitlements where account_id=p_account_id and environment=result.environment
    and revoked_at is null and status in ('active','expired') order by expires_at desc limit 1;
  if latest.id is null then raise exception 'Referral credit needs an Apple subscription'; end if;
  update pulsedeals_referral_redemptions set product_id=latest.product_id,original_transaction_id=latest.original_transaction_id,
    nonce=gen_random_uuid(),issued_at=floor(extract(epoch from clock_timestamp())*1000)::bigint
    where id=p_id returning * into result;
  return result;
end $$;

-- Aggregate in PostgreSQL so balances are not truncated by PostgREST row limits.
create function public.pulsedeals_referral_summary(p_account_id uuid,p_environment text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare own_code text; result jsonb;
begin
  own_code := pulsedeals_referral_code(p_account_id);
  select jsonb_build_object(
    'code',own_code,
    'availableWeeks',(select count(*) from pulsedeals_referrals r where r.referrer_id=p_account_id
      and r.environment=p_environment and r.qualified_at is not null and r.revoked_at is null
      and not exists(select 1 from pulsedeals_referral_redemptions d where d.referral_id=r.id)),
    'earnedWeeks',(select count(*) from pulsedeals_referrals r where r.referrer_id=p_account_id
      and r.environment=p_environment and r.qualified_at is not null and r.revoked_at is null),
    'usedWeeks',(select count(*) from pulsedeals_referral_redemptions d where d.account_id=p_account_id
      and d.environment=p_environment and d.applied_at is not null),
    'pendingWeeks',case when pending.id is null then 0 else 1 end,
    'pendingInvites',(select count(*) from pulsedeals_referrals r where r.referrer_id=p_account_id and r.qualified_at is null and r.revoked_at is null),
    'claimedCode',claimed.code,
    'claimQualified',claimed.qualified_at is not null and claimed.revoked_at is null,
    'canClaim',claimed.id is null and a.created_at>=(select started_at from pulsedeals_referral_program)
      and not exists(select 1 from pulsedeals_entitlements where account_id=p_account_id)
      and not exists(select 1 from pulsedeals_referral_transactions where account_id=p_account_id)
      and not exists(select 1 from pulsedeals_discord_links where account_id=p_account_id and paid_tier is not null),
    'redemptionProductID',case when m.source='discord' then null else coalesce(e.product_id,pending.product_id) end,
    'retryAfter',case when pending.id is null then null else to_char(
      (to_timestamp(pending.issued_at::double precision/1000)+interval '25 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
    'offerID','referral-week'
  ) into result from pulsedeals_accounts a
    left join pulsedeals_referrals claimed on claimed.referred_id=a.id
    left join pulsedeals_referral_redemptions pending on pending.account_id=a.id and pending.environment=p_environment
      and pending.applied_at is null and pending.voided_at is null
    left join lateral (select product_id from pulsedeals_entitlements where account_id=a.id and environment=p_environment
      and revoked_at is null and status in ('active','expired') order by expires_at desc limit 1) e on true
    left join lateral pulsedeals_membership(a.id) m on true where a.id=p_account_id;
  return result;
end $$;

do $$ declare item record; begin
  for item in select tablename from pg_tables where schemaname='public' and tablename like 'pulsedeals_referral%'
  loop
    execute format('alter table public.%I enable row level security',item.tablename);
    execute format('revoke all on public.%I from anon,authenticated',item.tablename);
    execute format('grant all on public.%I to service_role',item.tablename);
  end loop;
  for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and (p.proname like '%pulsedeals_referral%' or p.proname like 'record_pulsedeals_apple_entitlement%')
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',item.signature);
    execute format('grant execute on function %s to service_role',item.signature);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
