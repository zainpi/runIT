-- Product expansion feedback; no subscription or shopping access is granted.
create table public.pulsedeals_country_requests (
  account_id uuid not null references public.pulsedeals_accounts(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$' and country_code not in ('DE','GB','UK','ES','FR','IT')),
  created_at timestamptz not null default now(),
  primary key (account_id, country_code)
);

create index pulsedeals_country_requests_country_idx on public.pulsedeals_country_requests(country_code, created_at);
alter table public.pulsedeals_country_requests enable row level security;
revoke all on public.pulsedeals_country_requests from public, anon, authenticated;
grant all on public.pulsedeals_country_requests to service_role;
