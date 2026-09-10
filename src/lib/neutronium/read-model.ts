import {
  Actor,
  Workspace,
  DomainError,
  canAdmin,
  canManagePeople,
  platformRoles,
  project,
} from "./model";
import type { PoolClient } from "pg";
import { tenantConnection } from "./postgres";
import { readWorkspace } from "./store";
const pageBuckets: Record<string, string> = {
  people: "employees",
  onboarding: "jobs",
  jobs: "jobs",
  access: "requests",
  requests: "requests",
  permissions: "grants",
  myaccess: "grants",
  alerts: "grants",
  audit: "audit",
  notifications: "notifications",
  templates: "templates",
  applications: "applications",
  apps: "applications",
};
const allowedBuckets = [
  "employees",
  "applications",
  "templates",
  "grants",
  "requests",
  "jobs",
  "audit",
  "notifications",
  "integrations",
] as const;
export async function readView(
  a: Actor,
  params: URLSearchParams,
): Promise<Workspace> {
  if (a.demo) return project(await readWorkspace(a.orgId, true), a);
  return readViewOnClient(await tenantConnection(a.orgId), a, params);
}
export async function readViewOnClient(
  client: PoolClient,
  a: Actor,
  params: URLSearchParams,
): Promise<Workspace> {
  try {
    await client.query("begin isolation level repeatable read read only");
    const org = (
      await client.query(
        "select id,name,revision,metadata from neutronium_organizations where id=$1",
        [a.orgId],
      )
    ).rows[0];
    if (!org) throw new DomainError("Company not found.", 404);
    const view = params.get("view") || "overview",
      selected = pageBuckets[view],
      cursor = params.get("cursor") || "";
    if (cursor && !/^[0-9a-f-]{36}$/i.test(cursor))
      throw new DomainError("Invalid page cursor.");
    const q = (params.get("q") || "").slice(0, 150),
      status = params.get("status") || "all";
    const w = {
      ...org.metadata,
      id: org.id,
      name: org.name,
      revision: Number(org.revision),
      helpRequests: [],
    } as Workspace;
    const privileged = canManagePeople(a) || platformRoles.includes(a.role);
    for (const bucket of allowedBuckets) {
      const values: unknown[] = [a.orgId],
        conditions = ["r.organization_id=$1"];
      const bind = (v: unknown) => {
        values.push(v);
        return `$${values.length}`;
      };
      if (!privileged) {
        if (["grants", "jobs"].includes(bucket))
          conditions.push(
            `r.payload->>'employeeId'=${bind(a.employeeId || "")}`,
          );
        if (bucket === "requests") {
          const own = bind(a.employeeId || "");
          const stage =
            "r.payload->'stages'->>(select count(*)::int from jsonb_array_elements(r.payload->'approvals') ap where ap->>'decision'='approve')";
          const manager =
            a.role === "MANAGER"
              ? `(${stage}='manager' and exists(select 1 from neutronium_employees e where e.organization_id=r.organization_id and e.id::text=r.payload->>'employeeId' and e.payload->>'managerId'=${own}))`
              : "false";
          const owner = ["MANAGER", "APPROVER"].includes(a.role)
            ? `(${stage}='owner' and exists(select 1 from neutronium_applications ap where ap.organization_id=r.organization_id and ap.id::text=r.payload->>'applicationId' and ap.payload->>'ownerId'=${own}))`
            : "false";
          conditions.push(
            `(r.payload->>'employeeId'=${own} or (r.payload->>'status' in ('pending','more_info') and (${manager} or ${owner})))`,
          );
        }
        if (bucket === "audit")
          conditions.push(
            `(r.payload->>'actorId'=${bind(a.id)} or r.payload->>'target'=${bind(a.employeeId || "")})`,
          );
        if (["integrations", "templates"].includes(bucket))
          conditions.push("false");
      }
      if (bucket === "notifications")
        conditions.push(
          `r.payload->>'recipientId'=any(${bind([a.id, a.employeeId || "", ...(canAdmin(a) ? ["admins"] : [])])}::text[])`,
        );
      if (bucket === "employees" && !privileged)
        conditions.push(`r.id::text=${bind(a.employeeId || "")}`);
      if (bucket === selected) {
        if (view === "apps")
          conditions.push(
            `exists(select 1 from neutronium_grants g where g.organization_id=r.organization_id and g.application_id=r.id and g.employee_id=${bind(a.employeeId || null)}::uuid and g.payload->>'status'='active')`,
          );
        if (cursor) conditions.push(`r.id>${bind(cursor)}::uuid`);
        if (status !== "all")
          conditions.push(`r.payload->>'status'=${bind(status)}`);
        if (view === "requests")
          conditions.push(
            `r.payload->>'employeeId'=${bind(a.employeeId || "")}`,
          );
        if (view === "alerts")
          conditions.push(
            `r.payload->>'status'='active' and (r.payload->>'level'='Admin' or (r.payload->>'expiresAt')::timestamptz<now()+interval '1 day' or exists(select 1 from neutronium_employees e where e.organization_id=r.organization_id and e.id::text=r.payload->>'employeeId' and e.payload->>'status'='terminated'))`,
          );
        if (q) {
          const term = bind(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
          conditions.push(
            `(concat_ws(' ',r.payload->>'firstName',r.payload->>'lastName',r.payload->>'email',r.payload->>'department',r.payload->>'name',r.payload->>'description',r.payload->>'kind',r.payload->>'status',r.payload->>'action',r.payload->>'actor',r.payload->>'target',r.payload->>'level',r.payload->>'title',r.payload->>'body') ilike ${term} or exists(select 1 from neutronium_employees e where e.organization_id=r.organization_id and e.id::text=r.payload->>'employeeId' and concat(e.payload->>'firstName',' ',e.payload->>'lastName') ilike ${term}))`,
          );
        }
      }
      const limit =
        bucket === selected
          ? 50
          : ["applications", "templates", "integrations"].includes(bucket)
            ? 100
            : 10;
      const records = (
        await client.query(
          `select r.payload from neutronium_${bucket} r where ${conditions.join(" and ")} order by r.id limit ${limit + 1}`,
          values,
        )
      ).rows.map((r) => r.payload);
      (w as any)[bucket] = records.slice(0, limit);
      if (bucket === selected)
        w.pageInfo = {
          view,
          cursor,
          nextCursor: records.length > limit ? records[limit - 1].id : null,
          shown: Math.min(records.length, limit),
          ids: records.slice(0, limit).map((r) => r.id),
        };
    }
    if (selected === "employees")
      w.directoryPageIds = w.employees.map((e) => e.id);
    // Keep reference catalogs complete while the primary list is paginated.
    // These supply existing assignment/template forms; transactional history stays bounded.
    for (const bucket of ["employees", "applications", "templates"] as const) {
      if (!privileged && bucket !== "applications") continue;
      w[bucket] = (
        await client.query(
          `select payload from neutronium_${bucket} where organization_id=$1 order by id`,
          [a.orgId],
        )
      ).rows.map((r) => r.payload);
    }
    if (!privileged && selected !== "grants")
      w.grants = (
        await client.query(
          "select payload from neutronium_grants where organization_id=$1 and employee_id=$2 order by id",
          [a.orgId, a.employeeId || null],
        )
      ).rows.map((r) => r.payload);

    const employeeIds = [
      a.employeeId,
      ...w.requests.map((r) => r.employeeId),
      ...w.jobs.map((j) => j.employeeId),
      ...w.grants.map((g) => g.employeeId),
      ...w.applications.map((app) => app.ownerId),
    ].filter(Boolean);
    if (employeeIds.length) {
      const rows = (
        await client.query(
          "select payload from neutronium_employees where organization_id=$1 and id=any($2::uuid[])",
          [a.orgId, employeeIds],
        )
      ).rows;
      for (const r of rows)
        if (!w.employees.some((e) => e.id === r.payload.id))
          w.employees.push(r.payload);
    }
    const appIds = [
      ...w.requests.map((r) => r.applicationId),
      ...w.grants.map((g) => g.applicationId),
      ...w.jobs.flatMap((j) => j.steps.map((s) => s.applicationId)),
    ].filter(Boolean);
    if (appIds.length) {
      const rows = (
        await client.query(
          "select payload from neutronium_applications where organization_id=$1 and id=any($2::uuid[])",
          [a.orgId, appIds],
        )
      ).rows;
      for (const r of rows)
        if (!w.applications.some((e) => e.id === r.payload.id))
          w.applications.push(r.payload);
    }
    if (a.employeeId)
      w.helpRequests = (
        await client.query(
          "select payload from neutronium_help_requests where organization_id=$1 and employee_id=$2 and payload->>'kind'='qa' and payload->>'fulfillment'='completed' order by id limit 100",
          [a.orgId, a.employeeId],
        )
      ).rows.map((r) => r.payload);
    if (privileged) {
      const row = (
        await client.query(
          `select (select count(*) from neutronium_employees where organization_id=$1 and payload->>'status'<>'terminated')::int employees,(select count(*) from neutronium_employees where organization_id=$1 and payload->>'status'='active')::int active,(select count(*) from neutronium_requests where organization_id=$1 and payload->>'status'='pending')::int pending,(select count(*) from neutronium_jobs where organization_id=$1 and payload->>'status'<>'success')::int workflows`,
          [a.orgId],
        )
      ).rows[0];
      w.summary = row;
      w.applicationGrantCounts = Object.fromEntries(
        (
          await client.query(
            "select application_id,count(distinct employee_id)::int n from neutronium_grants where organization_id=$1 and payload->>'status'='active' group by application_id",
            [a.orgId],
          )
        ).rows.map((r) => [r.application_id, r.n]),
      );
    }
    await client.query("commit");
    return project(w, a);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
