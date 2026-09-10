begin;
-- Separate the migration owner from the web/worker login. Password is installed
-- separately by 006_runtime_password.sh or a trusted administrator.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='neutronium_runtime') then create role neutronium_runtime nologin nosuperuser nobypassrls; end if;
 if not exists(select 1 from pg_roles where rolname='neutronium_app') then create role neutronium_app login nosuperuser nobypassrls; end if;
end $$;
grant neutronium_runtime to neutronium_app;
grant usage on schema public to neutronium_runtime;
-- Authentication tables are deliberately separate from tenant business records.
-- They are reachable only by server-side authentication code, never browser SQL.
grant select,insert,update,delete on neutronium_users,neutronium_sessions,neutronium_auth_tokens,neutronium_social_identities,neutronium_login_states,neutronium_mfa to neutronium_runtime;
grant select,insert on neutronium_account_audit to neutronium_runtime;
create policy neutronium_auth_mfa on neutronium_mfa for all to neutronium_runtime using(true) with check(true);
create policy neutronium_auth_audit on neutronium_account_audit for all to neutronium_runtime using(true) with check(true);
-- Membership lookup must precede selection of a company; mutations are scoped.
grant select,insert,update on neutronium_memberships to neutronium_runtime;
create policy neutronium_membership_read on neutronium_memberships for select to neutronium_runtime using(true);
create policy neutronium_membership_insert on neutronium_memberships for insert to neutronium_runtime with check(organization_id=nullif(current_setting('neutronium.tenant_id',true),'')::uuid);
create policy neutronium_membership_update on neutronium_memberships for update to neutronium_runtime using(organization_id=nullif(current_setting('neutronium.tenant_id',true),'')::uuid) with check(organization_id=nullif(current_setting('neutronium.tenant_id',true),'')::uuid);
grant select on neutronium_platform_members,neutronium_platform_scopes to neutronium_runtime;
create policy neutronium_platform_members_read on neutronium_platform_members for select to neutronium_runtime using(true);
create policy neutronium_platform_scopes_read on neutronium_platform_scopes for select to neutronium_runtime using(true);
do $$ declare bucket text; begin
 foreach bucket in array array['organizations','employees','applications','templates','grants','requests','jobs','audit','notifications','integrations','help_requests','credentials','oauth_states'] loop
  execute format('grant select,insert,update on neutronium_%I to neutronium_runtime',bucket);
  execute format('create policy neutronium_company_scope on neutronium_%I for all to neutronium_runtime using(%I=nullif(current_setting(''neutronium.tenant_id'',true),'''')::uuid) with check(%I=nullif(current_setting(''neutronium.tenant_id'',true),'''')::uuid)',bucket,case when bucket='organizations' then 'id' else 'organization_id' end,case when bucket='organizations' then 'id' else 'organization_id' end);
 end loop;
end $$;
revoke update on neutronium_audit from neutronium_runtime;
grant delete on neutronium_credentials,neutronium_oauth_states to neutronium_runtime;
-- Workspace compatibility functions must obey caller RLS rather than owner's access.
alter function neutronium_load(uuid) security invoker;
alter function neutronium_save(uuid,bigint,jsonb) security invoker;
alter function neutronium_create(jsonb,uuid) security invoker;
grant execute on function neutronium_load(uuid),neutronium_save(uuid,bigint,jsonb),neutronium_create(jsonb,uuid),neutronium_rate_limit(text,integer,integer) to neutronium_runtime;
create function neutronium_list_organizations(p_after uuid,p_limit integer)
returns table(id uuid,name text,revision bigint) language sql security definer set search_path=public as $$
 select id,name,revision from neutronium_organizations where p_after is null or id>p_after order by id limit least(greatest(p_limit,1),100)
$$;
revoke all on function neutronium_list_organizations(uuid,integer) from public;
grant execute on function neutronium_list_organizations(uuid,integer) to neutronium_runtime;
grant select,update on neutronium_worker_cursor to neutronium_runtime;
create index neutronium_notification_pending on neutronium_notifications(organization_id,(payload->>'emailStatus'),created_at,id);
commit;
