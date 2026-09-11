-- Billing cadence does not change country access. Keep all existing products
-- available for restores and let Apple's subscription group manage switches.
insert into public.pulsedeals_product_tiers (product_id, tier) values
  ('com.pulsedeals.subscription.yearly', 'standard'),
  ('com.pulsedeals.subscription.pro.yearly', 'pro')
on conflict (product_id) do update set tier = excluded.tier;
