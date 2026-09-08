-- Neutronium is isolated from the website's existing Supabase tables.
-- Clients have no direct write access. Server commands validate RBAC and use service-role RPCs.
create table public.neutronium_organizations (
 id uuid primary key, name text not null, revision bigint not null default 0,
 metadata jsonb not null, created_at timestamptz not null default now()
);
create table public.neutronium_memberships (
 organization_id uuid not null references public.neutronium_organizations(id),
 user_id uuid not null references auth.users(id), role text not null check (role in ('ORG_OWNER','ORG_ADMIN','HR_ADMIN','MANAGER','APPROVER','EMPLOYEE')),
 employee_id uuid, active boolean not null default true, created_at timestamptz not null default now(),
 primary key (organization_id,user_id), unique(organization_id,employee_id)
);
create table public.neutronium_platform_members (
 user_id uuid primary key references auth.users(id), role text not null check (role in ('PLATFORM_OWNER','PLATFORM_SUPPORT','PLATFORM_SECURITY','PLATFORM_READONLY'))
);
create table public.neutronium_credentials (
 organization_id uuid not null references public.neutronium_organizations(id), provider text not null,
 ciphertext text not null, key_version text not null, updated_at timestamptz not null default now(), primary key(organization_id,provider)
);
create table public.neutronium_oauth_states (
 id text primary key, organization_id uuid not null references public.neutronium_organizations(id), user_id uuid not null references auth.users(id),
 tenant_id uuid not null, features jsonb not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table public.neutronium_rate_limits (key text primary key, count integer not null, resets_at timestamptz not null);
create table public.neutronium_employees (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id), email text generated always as (lower(payload->>'email')) stored, unique(organization_id,email)
);
create table public.neutronium_applications (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id)
);
create table public.neutronium_templates (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id)
);
create table public.neutronium_grants (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id), employee_id uuid generated always as ((payload->>'employeeId')::uuid) stored, foreign key(organization_id,employee_id) references public.neutronium_employees(organization_id,id) deferrable initially deferred, application_id uuid generated always as ((payload->>'applicationId')::uuid) stored, foreign key(organization_id,application_id) references public.neutronium_applications(organization_id,id) deferrable initially deferred
);
create index neutronium_grants_employee on public.neutronium_grants(organization_id,employee_id);
create index neutronium_grants_status on public.neutronium_grants(organization_id,(payload->>'status'));
create table public.neutronium_requests (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id), employee_id uuid generated always as ((payload->>'employeeId')::uuid) stored, foreign key(organization_id,employee_id) references public.neutronium_employees(organization_id,id) deferrable initially deferred, application_id uuid generated always as ((payload->>'applicationId')::uuid) stored, foreign key(organization_id,application_id) references public.neutronium_applications(organization_id,id) deferrable initially deferred
);
create index neutronium_requests_employee on public.neutronium_requests(organization_id,employee_id);
create index neutronium_requests_status on public.neutronium_requests(organization_id,(payload->>'status'));
create table public.neutronium_jobs (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id), employee_id uuid generated always as ((payload->>'employeeId')::uuid) stored, foreign key(organization_id,employee_id) references public.neutronium_employees(organization_id,id) deferrable initially deferred
);
create index neutronium_jobs_employee on public.neutronium_jobs(organization_id,employee_id);
create index neutronium_jobs_status on public.neutronium_jobs(organization_id,(payload->>'status'));
create table public.neutronium_audit (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id)
);
create table public.neutronium_notifications (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id)
);
create table public.neutronium_integrations (
 organization_id uuid not null references public.neutronium_organizations(id), id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'), created_at timestamptz not null default now(),
 primary key(organization_id,id)
);
alter table public.neutronium_memberships add foreign key(organization_id,employee_id) references public.neutronium_employees(organization_id,id) deferrable initially deferred;
create index neutronium_memberships_user on public.neutronium_memberships(user_id) where active;
create index neutronium_grants_expiry on public.neutronium_grants((payload->>'expiresAt')) where payload->>'status' = 'active';
create index neutronium_jobs_schedule on public.neutronium_jobs((payload->>'scheduledAt')) where payload->>'status' in ('pending','running');
create index neutronium_audit_time on public.neutronium_audit(organization_id,(payload->>'at'));
create or replace function public.neutronium_audit_immutable() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'Audit events are append-only'; end; $$;
create trigger neutronium_audit_append_only before update or delete on public.neutronium_audit for each row execute function public.neutronium_audit_immutable();
alter table public.neutronium_organizations enable row level security;
revoke all on public.neutronium_organizations from anon, authenticated;
grant all on public.neutronium_organizations to service_role;
alter table public.neutronium_memberships enable row level security;
revoke all on public.neutronium_memberships from anon, authenticated;
grant all on public.neutronium_memberships to service_role;
alter table public.neutronium_platform_members enable row level security;
revoke all on public.neutronium_platform_members from anon, authenticated;
grant all on public.neutronium_platform_members to service_role;
alter table public.neutronium_credentials enable row level security;
revoke all on public.neutronium_credentials from anon, authenticated;
grant all on public.neutronium_credentials to service_role;
alter table public.neutronium_oauth_states enable row level security;
revoke all on public.neutronium_oauth_states from anon, authenticated;
grant all on public.neutronium_oauth_states to service_role;
alter table public.neutronium_rate_limits enable row level security;
revoke all on public.neutronium_rate_limits from anon, authenticated;
grant all on public.neutronium_rate_limits to service_role;
alter table public.neutronium_employees enable row level security;
revoke all on public.neutronium_employees from anon, authenticated;
grant all on public.neutronium_employees to service_role;
alter table public.neutronium_applications enable row level security;
revoke all on public.neutronium_applications from anon, authenticated;
grant all on public.neutronium_applications to service_role;
alter table public.neutronium_templates enable row level security;
revoke all on public.neutronium_templates from anon, authenticated;
grant all on public.neutronium_templates to service_role;
alter table public.neutronium_grants enable row level security;
revoke all on public.neutronium_grants from anon, authenticated;
grant all on public.neutronium_grants to service_role;
alter table public.neutronium_requests enable row level security;
revoke all on public.neutronium_requests from anon, authenticated;
grant all on public.neutronium_requests to service_role;
alter table public.neutronium_jobs enable row level security;
revoke all on public.neutronium_jobs from anon, authenticated;
grant all on public.neutronium_jobs to service_role;
alter table public.neutronium_audit enable row level security;
revoke all on public.neutronium_audit from anon, authenticated;
grant all on public.neutronium_audit to service_role;
alter table public.neutronium_notifications enable row level security;
revoke all on public.neutronium_notifications from anon, authenticated;
grant all on public.neutronium_notifications to service_role;
alter table public.neutronium_integrations enable row level security;
revoke all on public.neutronium_integrations from anon, authenticated;
grant all on public.neutronium_integrations to service_role;
-- Defense in depth: no browser policy can expose another tenant. All data is
-- fetched through authenticated server projection; employee PII is filtered there.
create or replace function public.neutronium_load(p_org uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; bucket text; items jsonb;
begin
 select metadata || jsonb_build_object('id',id,'name',name,'revision',revision) into result from neutronium_organizations where id=p_org;
 if result is null then return null; end if;
 foreach bucket in array ARRAY['employees','applications','templates','grants','requests','jobs','audit','notifications','integrations'] loop
  execute format('select coalesce(jsonb_agg(payload order by created_at,id), ''[]''::jsonb) from public.neutronium_%I where organization_id=$1',bucket) into items using p_org;
  result := result || jsonb_build_object(bucket,items);
 end loop;
 return result;
end; $$;
create or replace function public.neutronium_save(p_org uuid,p_revision bigint,p_state jsonb) returns boolean language plpgsql security definer set search_path=public as $$
declare current_revision bigint; bucket text; item jsonb;
begin
 select revision into current_revision from neutronium_organizations where id=p_org for update;
 if current_revision is null or current_revision <> p_revision then return false; end if;
 if p_state->>'id' <> p_org::text then raise exception 'Tenant mismatch'; end if;
 update neutronium_organizations set name=p_state->>'name',revision=revision+1,
 metadata=p_state - ARRAY['employees','applications','templates','grants','requests','jobs','audit','notifications','integrations','revision','id','name'] where id=p_org;
 foreach bucket in array ARRAY['employees','applications','templates','grants','requests','jobs','audit','notifications','integrations'] loop
  for item in select value from jsonb_array_elements(p_state->bucket) loop
   if bucket = 'audit' then
    insert into neutronium_audit(organization_id,id,payload) values(p_org,(item->>'id')::uuid,item) on conflict do nothing;
   else
    execute format('insert into public.neutronium_%I(organization_id,id,payload) values($1,$2,$3) on conflict(organization_id,id) do update set payload=excluded.payload',bucket) using p_org,(item->>'id')::uuid,item;
   end if;
  end loop;
 end loop;
 return true;
end; $$;
create or replace function public.neutronium_create(p_state jsonb,p_owner uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare org uuid := (p_state->>'id')::uuid;
begin
 if p_owner is null then raise exception 'Owner required'; end if;
 insert into neutronium_organizations(id,name,metadata) values(org,p_state->>'name',p_state);
 perform neutronium_save(org,0,p_state);
 insert into neutronium_memberships(organization_id,user_id,role) values(org,p_owner,'ORG_OWNER');
 return org;
end; $$;
create or replace function public.neutronium_rate_limit(p_key text,p_limit int,p_seconds int) returns boolean language plpgsql security definer set search_path=public as $$
declare hits int;
begin
 insert into neutronium_rate_limits(key,count,resets_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set count=case when neutronium_rate_limits.resets_at < now() then 1 else neutronium_rate_limits.count+1 end,
 resets_at=case when neutronium_rate_limits.resets_at < now() then now()+make_interval(secs=>p_seconds) else neutronium_rate_limits.resets_at end returning count into hits;
 return hits <= p_limit;
end; $$;
revoke all on function public.neutronium_load(uuid) from public,anon,authenticated;
grant execute on function public.neutronium_load(uuid) to service_role;
revoke all on function public.neutronium_save(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.neutronium_save(uuid,bigint,jsonb) to service_role;
revoke all on function public.neutronium_create(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.neutronium_create(jsonb,uuid) to service_role;
revoke all on function public.neutronium_rate_limit(text,int,int) from public,anon,authenticated;
grant execute on function public.neutronium_rate_limit(text,int,int) to service_role;
-- Non-owner platform staff can inspect only explicitly assigned customers.
create table public.neutronium_platform_scopes (
 user_id uuid not null references public.neutronium_platform_members(user_id),
 organization_id uuid not null references public.neutronium_organizations(id),
 created_at timestamptz not null default now(), primary key(user_id,organization_id)
);
alter table public.neutronium_platform_scopes enable row level security;
revoke all on public.neutronium_platform_scopes from anon,authenticated;
grant all on public.neutronium_platform_scopes to service_role;
-- Typed relational invariants also guard malformed service writes.
alter table public.neutronium_employees add constraint neutronium_employee_status check(payload->>'status' in ('active','onboarding','offboarding','terminated'));
alter table public.neutronium_jobs add constraint neutronium_job_status check(payload->>'status' in ('pending','running','success','failed','manual_required'));
alter table public.neutronium_requests add constraint neutronium_request_status check(payload->>'status' in ('pending','more_info','approved','rejected','fulfilled'));
alter table public.neutronium_grants add constraint neutronium_grant_status check(payload->>'status' in ('active','revoking','revoked','manual_required'));
alter table public.neutronium_applications add constraint neutronium_application_mode check(payload->>'mode' in ('development','manual','coming_soon','microsoft'));
alter table public.neutronium_employees add column manager_id uuid generated always as (nullif(payload->>'managerId','')::uuid) stored;
alter table public.neutronium_employees add foreign key(organization_id,manager_id) references public.neutronium_employees(organization_id,id) deferrable initially deferred;
alter table public.neutronium_employees add column template_id uuid generated always as (nullif(payload->>'templateId','')::uuid) stored;
alter table public.neutronium_employees add foreign key(organization_id,template_id) references public.neutronium_templates(organization_id,id) deferrable initially deferred;
