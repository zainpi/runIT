-- Back up database and private files before applying. Apply once, in a transaction.
begin;
create table neutronium_help_requests (
 organization_id uuid not null references neutronium_organizations(id), id uuid not null,
 payload jsonb not null, created_at timestamptz not null default now(), primary key(organization_id,id),
 employee_id uuid generated always as ((payload->>'employeeId')::uuid) stored,
 foreign key(organization_id,employee_id) references neutronium_employees(organization_id,id) deferrable initially deferred
);
alter table neutronium_help_requests enable row level security;
revoke all on neutronium_help_requests from public;
create index on neutronium_help_requests(organization_id,(payload->>'fulfillment'),id);
create index on neutronium_help_requests(organization_id,employee_id,id);
create index on neutronium_help_requests(organization_id,(payload->>'dueAt'));
insert into neutronium_help_requests(organization_id,id,payload)
select o.id,(r->>'id')::uuid,r from neutronium_organizations o cross join lateral jsonb_array_elements(coalesce(o.metadata->'helpRequests','[]'::jsonb)) r on conflict do nothing;
update neutronium_organizations set metadata=metadata-'helpRequests';
create or replace function public.neutronium_load(p_org uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; bucket text; items jsonb;
begin
 select metadata || jsonb_build_object('id',id,'name',name,'revision',revision) into result from neutronium_organizations where id=p_org;
 if result is null then return null; end if;
 foreach bucket in array ARRAY['employees','applications','templates','grants','requests','jobs','audit','notifications','integrations','help_requests'] loop
  execute format('select coalesce(jsonb_agg(payload order by created_at,id), ''[]''::jsonb) from public.neutronium_%I where organization_id=$1',bucket) into items using p_org;
  result := result || jsonb_build_object(case when bucket='help_requests' then 'helpRequests' else bucket end,items);
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
 metadata=p_state - ARRAY['employees','applications','templates','grants','requests','jobs','audit','notifications','integrations','helpRequests','revision','id','name'] where id=p_org;
 foreach bucket in array ARRAY['employees','applications','templates','grants','requests','jobs','audit','notifications','integrations','help_requests'] loop
  for item in select value from jsonb_array_elements(coalesce(p_state->(case when bucket='help_requests' then 'helpRequests' else bucket end),'[]'::jsonb)) loop
   if bucket = 'audit' then
    insert into neutronium_audit(organization_id,id,payload) values(p_org,(item->>'id')::uuid,item) on conflict do nothing;
   else
    execute format('insert into public.neutronium_%I(organization_id,id,payload) values($1,$2,$3) on conflict(organization_id,id) do update set payload=excluded.payload where neutronium_%I.payload is distinct from excluded.payload',bucket,bucket) using p_org,(item->>'id')::uuid,item;
   end if;
  end loop;
 end loop;
 return true;
end; $$;

create table neutronium_worker_cursor (id boolean primary key default true check(id), after_id uuid);
insert into neutronium_worker_cursor(id) values(true);
revoke all on neutronium_worker_cursor from public;
commit;
