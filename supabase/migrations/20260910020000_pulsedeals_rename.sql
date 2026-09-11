-- Rename the existing service in place. Earlier migration files are immutable
-- history: fresh installations apply those files, then this same upgrade.
-- Coordinate this migration with the API/dispatcher release (see rollout doc).
begin;

do $$
declare item record;
begin
  -- ALTER keeps row IDs, foreign keys, grants, RLS, and sequence ownership.
  for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relname ~ '^heater_'
  loop
    execute format('alter table public.%I rename to %I', item.relname, replace(item.relname,'heater_','pulsedeals_'));
  end loop;

  for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='S' and c.relname ~ '^heater_'
  loop
    execute format('alter sequence public.%I rename to %I', item.relname, replace(item.relname,'heater_','pulsedeals_'));
  end loop;

  -- Renaming primary/unique constraints also renames their backing indexes.
  for item in select c.conname, c.conrelid::regclass as relation from pg_constraint c
    join pg_namespace n on n.oid=c.connamespace
    where n.nspname='public' and c.conrelid<>0 and c.conname ~ '^heater_'
  loop
    execute format('alter table %s rename constraint %I to %I', item.relation, item.conname, replace(item.conname,'heater_','pulsedeals_'));
  end loop;

  for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='i' and c.relname ~ '^heater_'
  loop
    execute format('alter index public.%I rename to %I', item.relname, replace(item.relname,'heater_','pulsedeals_'));
  end loop;

  -- Rename all RPCs before rewriting their SQL/PLpgSQL bodies so calls between
  -- functions resolve. ALTER preserves the function OID and existing grants.
  for item in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname ~ '(^|_)heater_'
  loop
    execute format('alter function public.%I(%s) rename to %I', item.proname, item.arguments, replace(item.proname,'heater_','pulsedeals_'));
  end loop;

  for item in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname ~ '(^|_)pulsedeals_'
  loop
    execute replace(pg_get_functiondef(item.oid),'heater_','pulsedeals_');
    -- These RPCs belong exclusively to the server, including on fresh installs.
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', item.proname, item.arguments);
    execute format('grant execute on function public.%I(%s) to service_role', item.proname, item.arguments);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
