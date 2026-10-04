-- Deals and matching push alerts are free. Keep ownership, cadence, leases, and deduplication.
-- Apply with the matching API/dispatcher release. Historical membership records stay intact.
begin;

create or replace function public.enqueue_pulsedeals_push_matches(p_marketplace text, p_product_id text)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
  with candidates as (
    select d.id as deal_id, d.current_price, d.title, d.asin, d.marketplace, d.reference_price,
      d.observed_at, a.id as alert_id, a.cadence, a.account_id, v.id as device_id,
      row_number() over (partition by v.id, a.id order by d.score desc, d.observed_at desc, d.id) as rank
    from pulsedeals_alerts a
    join pulsedeals_push_devices v on v.account_id = a.account_id and v.enabled
    join pulsedeals_deals d on d.marketplace = a.marketplace
    where a.is_enabled and d.marketplace = p_marketplace and d.marketplace in ('de','uk','es','fr','it') and d.status = 'live'
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
      and not exists (select 1 from pulsedeals_push_deliveries prior where prior.device_id = v.id
                      and prior.deal_id = d.id and prior.price = d.current_price)
      and (a.cadence = 'instant' or not exists (
        select 1 from pulsedeals_push_deliveries prior where prior.device_id = v.id and prior.alert_id = a.id
          and prior.state in ('pending','sending','sent')
          and prior.created_at > now() - case a.cadence when 'digest' then interval '24 hours' else interval '6 hours' end
      ))
  )
  insert into pulsedeals_push_deliveries(device_id, account_id, alert_id, deal_id, price, payload, expires_at)
  select device_id, account_id, alert_id, deal_id, current_price,
    jsonb_build_object('asin', asin, 'marketplace', marketplace,
      'expiresAt', to_char((observed_at + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'aps', jsonb_build_object('category','PULSE_DEAL','sound','default','thread-id','deals-' || marketplace,
        'alert',jsonb_build_object(
          'title', case marketplace when 'uk' then '£' else '€' end ||
            current_price::text || ' · ' || round((reference_price-current_price)/nullif(reference_price,0)*100)::text || '% off',
          'body', title))), observed_at + interval '1 hour'
  from candidates where rank <= case cadence when 'instant' then 10 else 1 end
  on conflict(device_id, deal_id, price) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke execute on function public.enqueue_pulsedeals_push_matches(text,text) from public, anon, authenticated;
grant execute on function public.enqueue_pulsedeals_push_matches(text,text) to service_role;

notify pgrst, 'reload schema';
commit;
