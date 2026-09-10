import type { PoolClient } from "pg";
import { tenantConnection } from "./postgres";
import { Workspace, DomainError, Job } from "./model";
/** Load only runnable jobs and the records needed by those jobs. Provider I/O runs after commit. */
export async function workerMutation<T>(
  orgId: string,
  fn: (w: Workspace) => T,
  jobId?: string,
): Promise<T> {
  return workerMutationOnClient(
    await tenantConnection(orgId),
    orgId,
    fn,
    jobId,
  );
}
export async function workerMutationOnClient<T>(
  client: PoolClient,
  orgId: string,
  fn: (w: Workspace) => T,
  jobId?: string,
): Promise<T> {
  try {
    await client.query("begin");
    const org = (
      await client.query(
        "select id,name,revision,metadata from neutronium_organizations where id=$1 for update",
        [orgId],
      )
    ).rows[0];
    if (!org) throw new DomainError("Company not found.", 404);
    const w = {
      ...org.metadata,
      id: org.id,
      name: org.name,
      revision: Number(org.revision),
      employees: [],
      applications: [],
      templates: [],
      grants: [],
      requests: [],
      jobs: [],
      audit: [],
      notifications: [],
      integrations: [],
      helpRequests: [],
    } as Workspace;
    w.jobs = (
      await client.query(
        jobId
          ? "select payload from neutronium_jobs where organization_id=$1 and id=$2"
          : `select j.payload from neutronium_jobs j left join lateral (select value step from jsonb_array_elements(j.payload->'steps') with ordinality s(value,position) where value->>'status' not in ('success','skipped') order by position limit 1) next on true where j.organization_id=$1 and j.payload->>'status' in ('pending','running') and (j.payload->>'scheduledAt')::timestamptz<=now() and coalesce((next.step->>'leaseUntil')::timestamptz,'-infinity')<=now() and coalesce((next.step->>'nextAttemptAt')::timestamptz,'-infinity')<=now() order by j.payload->>'scheduledAt',j.id limit 20 for update of j skip locked`,
        jobId ? [orgId, jobId] : [orgId],
      )
    ).rows.map((r) => r.payload);
    if (jobId && !w.jobs.length)
      throw new DomainError("Workflow not found.", 404);
    if (!jobId) {
      w.grants = (
        await client.query(
          "select payload from neutronium_grants where organization_id=$1 and payload->>'status' in ('active','manual_required') and (payload->>'expiresAt')::timestamptz<=now() order by payload->>'expiresAt',id limit 50 for update skip locked",
          [orgId],
        )
      ).rows.map((r) => r.payload);
      if (w.grants.length) {
        const operations = w.grants.map((g) => `revoke:${g.id}`);
        const existing = (
          await client.query(
            "select payload from neutronium_jobs where organization_id=$1 and payload->>'kind'='revoke' and exists(select 1 from jsonb_array_elements(payload->'steps') s where s->>'operation'=any($2::text[]))",
            [orgId, operations],
          )
        ).rows.map((r) => r.payload as Job);
        for (const j of existing)
          if (!w.jobs.some((x) => x.id === j.id)) w.jobs.push(j);
      }
      w.helpRequests = (
        await client.query(
          `select h.payload from neutronium_help_requests h where h.organization_id=$1 and coalesce(h.payload->>'fulfillment',h.payload->>'status') not in ('completed','cancelled','resolved') and ((h.payload->>'dueAt')::timestamptz<now() or (h.payload->>'expiresAt')::timestamptz<now()+interval '1 day') and not exists(select 1 from neutronium_notifications n where n.organization_id=h.organization_id and n.payload->>'dedupeKey'=concat('request:',h.id,':',case when (h.payload->>'dueAt')::timestamptz<now() then 'overdue' else 'expiring' end,':',to_char(now() at time zone 'UTC','YYYY-MM-DD'))) order by h.id limit 50`,
          [orgId],
        )
      ).rows.map((r) => r.payload);
    }
    const employeeIds = [
      ...new Set([
        ...w.jobs.map((j) => j.employeeId),
        ...w.grants.map((g) => g.employeeId),
      ]),
    ];
    if (employeeIds.length) {
      w.employees = (
        await client.query(
          "select payload from neutronium_employees where organization_id=$1 and id=any($2::uuid[])",
          [orgId, employeeIds],
        )
      ).rows.map((r) => r.payload);
      const grants = (
        await client.query(
          "select payload from neutronium_grants where organization_id=$1 and employee_id=any($2::uuid[])",
          [orgId, employeeIds],
        )
      ).rows.map((r) => r.payload);
      for (const g of grants)
        if (!w.grants.some((x) => x.id === g.id)) w.grants.push(g);
    }
    const requestIds = w.jobs.map((j) => j.requestId).filter(Boolean);
    if (requestIds.length)
      w.requests = (
        await client.query(
          "select payload from neutronium_requests where organization_id=$1 and id=any($2::uuid[])",
          [orgId, requestIds],
        )
      ).rows.map((r) => r.payload);
    const appIds = [
      ...new Set([
        ...w.grants.map((g) => g.applicationId),
        ...w.jobs.flatMap((j) =>
          j.steps.map((s) => s.applicationId).filter(Boolean),
        ),
      ]),
    ];
    if (appIds.length)
      w.applications = (
        await client.query(
          "select payload from neutronium_applications where organization_id=$1 and id=any($2::uuid[])",
          [orgId, appIds],
        )
      ).rows.map((r) => r.payload);
    w.integrations = (
      await client.query(
        "select payload from neutronium_integrations where organization_id=$1",
        [orgId],
      )
    ).rows.map((r) => r.payload);
    const before = structuredClone(w);
    const result = fn(w);
    let changed = false;
    for (const bucket of [
      "employees",
      "grants",
      "requests",
      "jobs",
      "audit",
      "notifications",
    ] as const)
      for (const item of w[bucket]) {
        const previous = before[bucket].find((x) => x.id === item.id);
        if (JSON.stringify(previous) === JSON.stringify(item)) continue;
        changed = true;
        if (bucket === "audit")
          await client.query(
            "insert into neutronium_audit(organization_id,id,payload) values($1,$2,$3)",
            [orgId, item.id, JSON.stringify(item)],
          );
        else
          await client.query(
            `insert into neutronium_${bucket}(organization_id,id,payload) values($1,$2,$3) on conflict(organization_id,id) do update set payload=excluded.payload`,
            [orgId, item.id, JSON.stringify(item)],
          );
      }
    if (changed)
      await client.query(
        "update neutronium_organizations set revision=revision+1 where id=$1",
        [orgId],
      );
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
export async function readWorkerState(orgId: string, jobId: string) {
  return workerMutation(orgId, (w) => structuredClone(w), jobId);
}
