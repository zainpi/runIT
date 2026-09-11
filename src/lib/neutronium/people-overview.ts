import type { PoolClient } from "pg";
import { admins, requireRole, type Actor } from "./model";
import { tenantConnection } from "./postgres";
export async function peopleOverview(a: Actor, params: URLSearchParams) {
  requireRole(a, [...admins, "HR_ADMIN"]);
  if (a.demo) return { rows: [], total: 0, page: 0 };
  return peopleOverviewOnClient(await tenantConnection(a.orgId), a, params);
}
export async function peopleOverviewOnClient(
  client: PoolClient,
  a: Actor,
  params: URLSearchParams,
) {
  try {
    requireRole(a, [...admins, "HR_ADMIN"]);
    const page =
      Math.max(0, Math.min(100000, Number(params.get("page")) || 0)) | 0;
    const sort = [
      "name",
      "email",
      "department",
      "start_date",
      "status",
    ].includes(params.get("sort") || "")
      ? params.get("sort")!
      : "name";
    const direction = params.get("direction") === "desc" ? "desc" : "asc";
    const q = `%${(params.get("q") || "").slice(0, 150).replace(/[\\%_]/g, "\\$&")}%`;
    const sql = `with people as (
      select e.id,'employee' as kind,concat_ws(' ',e.payload->>'firstName',e.payload->>'lastName') as name,
      e.payload->>'email' as email,e.payload->>'department' as department,e.payload->>'startDate' as start_date,e.payload->>'title' as title,e.payload->>'location' as location,e.payload->>'managerId' as manager_id,e.payload->>'status' as employee_status,
      case when a.id is null or e.payload->>'status' in ('offboarding','terminated') then e.payload->>'status' when j.payload->>'status'='success' then 'complete' else 'accepted' end as status,
      a.id as application_id,e.id as employee_id,concat_ws(' ',e.payload::text,a.details::text) as searchable
      from neutronium_employees e left join neutronium_employee_applications a on a.organization_id=e.organization_id and a.employee_id=e.id
      left join neutronium_jobs j on j.organization_id=a.organization_id and j.id=a.job_id where e.organization_id=$1
      union all
      select a.id,'application',concat_ws(' ',a.details->>'firstName',a.details->>'lastName'),coalesce(u.email,a.contact_email),a.details->>'department',a.details->>'startDate',a.details->>'title',a.details->>'location',a.details->>'managerId',null::text,a.status,a.id,null::uuid,concat_ws(' ',a.details::text,u.email,a.contact_email)
      from neutronium_employee_applications a left join neutronium_users u on u.id=a.user_id where a.organization_id=$1 and a.employee_id is null
    ), filtered as (select * from people where searchable ilike $2 and ($3='' or status=$3 or employee_status=$3) and ($4='' or department=$4) and ($5='' or start_date>=$5) and ($6='' or start_date<=$6) and ($7='' or kind=$7) and ($8='' or manager_id=$8))
    select (select count(*)::int from filtered) total, (select coalesce(jsonb_agg(department order by department),'[]') from (select distinct department from people where coalesce(department,'')<>'') teams) departments, coalesce((select jsonb_agg(row_to_json(p)) from (select * from filtered order by ${sort} ${direction} nulls last,id limit 50 offset $9) p),'[]') rows`;
    const result = (
      await client.query(sql, [
        a.orgId,
        q,
        params.get("status") || "",
        params.get("department") || "",
        params.get("startFrom") || "",
        params.get("startTo") || "",
        params.get("kind") || "",
        params.get("manager") || "",
        page * 50,
      ])
    ).rows[0];
    return { ...result, page };
  } finally {
    client.release();
  }
}
export async function workspaceAttention(a: Actor) {
  requireRole(a, [...admins, "HR_ADMIN"]);
  if (a.demo)
    return {
      applications: [],
      pendingApplications: 0,
      access: 0,
      workflows: 0,
      help: 0,
    };
  const client = await tenantConnection(a.orgId);
  try {
    const summary = (
      await client.query(
        `select
      (select count(*)::int from neutronium_employee_applications where organization_id=$1 and status in ('pending','in_review','more_info')) as "pendingApplications",
      (select count(*)::int from neutronium_requests where organization_id=$1 and payload->>'status' in ('pending','more_info')) access,
      (select count(*)::int from neutronium_jobs where organization_id=$1 and payload->>'status' in ('failed','manual_required')) workflows,
      (select count(*)::int from neutronium_help_requests where organization_id=$1 and coalesce(payload->>'fulfillment',payload->>'status') not in ('completed','cancelled','resolved')) help`,
        [a.orgId],
      )
    ).rows[0];
    const applications = (
      await client.query(
        "select id,details,status from neutronium_employee_applications where organization_id=$1 and status in ('pending','in_review','more_info') order by submitted_at,id limit 5",
        [a.orgId],
      )
    ).rows;
    return {
      ...summary,
      help: admins.includes(a.role) ? summary.help : 0,
      applications,
    };
  } finally {
    client.release();
  }
}
