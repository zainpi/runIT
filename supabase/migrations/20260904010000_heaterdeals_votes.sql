-- One community signal per account and product. Updating a vote moves the
-- account between buckets instead of creating duplicate votes.

create table if not exists public.heater_deal_votes (
  account_id uuid not null references public.heater_accounts(id) on delete cascade,
  asin text not null check (char_length(asin) between 6 and 32),
  vote text not null check (vote in ('good', 'bought', 'bad')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, asin)
);

create index if not exists heater_deal_votes_product_idx
  on public.heater_deal_votes(asin, vote, updated_at desc);

alter table public.heater_deal_votes enable row level security;

revoke all on public.heater_deal_votes from anon, authenticated;

grant usage on schema public to service_role;
grant all on public.heater_deal_votes to service_role;
