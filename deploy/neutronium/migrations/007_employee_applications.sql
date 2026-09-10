begin;
alter table neutronium_auth_tokens add column return_to text;

create table neutronium_onboarding_links (
 id uuid primary key,
 organization_id uuid not null references neutronium_organizations(id),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references neutronium_users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 unique(organization_id,id)
);
create table neutronium_employee_applications (
 id uuid primary key,
 organization_id uuid not null references neutronium_organizations(id),
 link_id uuid not null unique,
 user_id uuid not null references neutronium_users(id),
 details jsonb not null check(jsonb_typeof(details)='object'),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references neutronium_users(id),
 decision_note text not null default '',
 employee_id uuid,
 job_id uuid,
 foreign key(organization_id,link_id) references neutronium_onboarding_links(organization_id,id),
 foreign key(organization_id,employee_id) references neutronium_employees(organization_id,id),
 foreign key(organization_id,job_id) references neutronium_jobs(organization_id,id),
 check((status='pending' and reviewed_at is null and reviewed_by is null and employee_id is null and job_id is null)
    or (status='declined' and reviewed_at is not null and reviewed_by is not null and employee_id is null and job_id is null)
    or (status='accepted' and reviewed_at is not null and reviewed_by is not null and employee_id is not null and job_id is not null))
);
create unique index neutronium_employee_application_open on neutronium_employee_applications(organization_id,user_id) where status in ('pending','accepted');
create index neutronium_employee_application_inbox on neutronium_employee_applications(organization_id,status,submitted_at desc,id desc);
create index neutronium_onboarding_link_recent on neutronium_onboarding_links(organization_id,created_at desc);
alter table neutronium_onboarding_links enable row level security;
alter table neutronium_employee_applications enable row level security;
create policy neutronium_link_scope on neutronium_onboarding_links for all to neutronium_runtime
 using(organization_id=nullif(current_setting('neutronium.tenant_id',true),'')::uuid)
 with check(organization_id=nullif(current_setting('neutronium.tenant_id',true),'')::uuid);
create policy neutronium_application_scope on neutronium_employee_applications for all to neutronium_runtime
 using(organization_id=nullif(current_setting('neutronium.tenant_id',true),'')::uuid)
 with check(organization_id=nullif(current_setting('neutronium.tenant_id',true),'')::uuid);
revoke all on neutronium_onboarding_links,neutronium_employee_applications from public;
grant select,insert,update on neutronium_onboarding_links,neutronium_employee_applications to neutronium_runtime;

-- Resolve only an unguessable invite hash before choosing a tenant. This grants
-- no membership and exposes no applicant or company records to browser SQL.
create function neutronium_resolve_onboarding_link(p_hash text)
returns table(id uuid,organization_id uuid) language sql stable security definer set search_path=public as $$
 select id,organization_id from neutronium_onboarding_links where token_hash=p_hash
$$;
revoke all on function neutronium_resolve_onboarding_link(text) from public;
grant execute on function neutronium_resolve_onboarding_link(text) to neutronium_runtime;
commit;
