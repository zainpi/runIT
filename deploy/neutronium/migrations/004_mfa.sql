begin;
alter table neutronium_sessions add column id uuid not null default gen_random_uuid();
alter table neutronium_sessions add column created_at timestamptz not null default now();
alter table neutronium_sessions add column mfa_verified_at timestamptz;
create unique index on neutronium_sessions(id);
create table neutronium_mfa (
 user_id uuid primary key references neutronium_users(id), ciphertext text not null, key_version text not null,
 enabled boolean not null default false, last_counter bigint not null default -1,
 pending_until timestamptz, recovery_hashes jsonb not null default '[]'
);
create table neutronium_account_audit (id uuid primary key default gen_random_uuid(), user_id uuid not null references neutronium_users(id), action text not null, at timestamptz not null default now());
create trigger neutronium_account_audit_immutable before update or delete on neutronium_account_audit for each row execute function neutronium_audit_immutable();
alter table neutronium_mfa enable row level security;
alter table neutronium_account_audit enable row level security;
revoke all on neutronium_mfa,neutronium_account_audit from public;
commit;
