alter table neutronium_users add column signup_role text not null default 'employee' check(signup_role in ('admin','employee'));
create table neutronium_social_identities (
 provider text not null, subject text not null, user_id uuid not null references neutronium_users(id),
 primary key(provider,subject), unique(provider,user_id)
);
create table neutronium_login_states (
 id text primary key, verifier text not null, nonce text not null, provider text not null,
 signup_role text not null, link_user_id uuid references neutronium_users(id), expires_at timestamptz not null
);
