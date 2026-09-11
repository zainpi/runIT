import { tenantConnection, tenantQuery } from "./postgres";
import {
  Actor,
  DomainError,
  canAdmin,
  platformRoles,
  HelpRequest,
} from "./model";
import { readWorkspace } from "./store";
import { fulfillment, visibleRequest, viewFilters } from "./operations";
export async function listServiceRequests(a: Actor, params: URLSearchParams) {
  if (platformRoles.includes(a.role))
    throw new DomainError("Not permitted.", 403);
  const limit = 25;
  const cursor = params.get("cursor") || "";
  if (
    cursor &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cursor,
    )
  )
    throw new DomainError("Invalid cursor.");
  const filter = params.get("filter") || "all",
    q = (params.get("q") || "").slice(0, 150);
  if (!viewFilters.includes(filter)) throw new DomainError("Invalid filter.");
  let records: HelpRequest[];
  if (a.demo) {
    const w = await readWorkspace(a.orgId, true);
    records = (w.helpRequests || [])
      .filter((r) => visibleRequest(r, a))
      .filter((r) => !cursor || r.id > cursor)
      .filter((r) =>
        `${r.subject} ${r.body}`.toLowerCase().includes(q.toLowerCase()),
      )
      .filter(
        (r) =>
          filter === "all" ||
          (filter === "mine" && r.ownerId === a.employeeId) ||
          (filter === "unassigned" && !r.ownerId) ||
          (filter === "overdue" &&
            !!r.dueAt &&
            Date.parse(r.dueAt) < Date.now() &&
            !["completed", "cancelled"].includes(fulfillment(r))) ||
          (filter === "waiting_for_admin" &&
            fulfillment(r) === "waiting_for_admin") ||
          (filter === "expiring" &&
            !!r.expiresAt &&
            Date.parse(r.expiresAt) < Date.now() + 86400000) ||
          (filter === "failed" &&
            w.jobs.some((j) => j.id === r.workflowId && j.status === "failed")),
      )
      .sort((x, y) => x.id.localeCompare(y.id))
      .slice(0, limit + 1);
  } else {
    const conditions = ["organization_id=$1"];
    const values: unknown[] = [a.orgId];
    function add(expr: string, v: unknown) {
      values.push(v);
      conditions.push(expr.replace("?", `$${values.length}`));
    }
    if (!canAdmin(a)) add("payload->>'employeeId' = ?", a.employeeId || "");
    if (cursor) add("id > ?::uuid", cursor);
    if (q)
      add(
        "concat(payload->>'subject',' ',payload->>'body') ilike ?",
        `%${q.replace(/[\\%_]/g, "\\$&")}%`,
      );
    if (filter === "mine") add("payload->>'ownerId' = ?", a.employeeId || "");
    if (filter === "unassigned")
      conditions.push("coalesce(payload->>'ownerId','')=''");
    if (filter === "overdue")
      conditions.push(
        "payload->>'dueAt' < to_char(now() at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') and coalesce(payload->>'fulfillment',payload->>'status') not in ('completed','cancelled','resolved')",
      );
    if (filter === "waiting_for_admin")
      conditions.push("payload->>'fulfillment'='waiting_for_admin'");
    if (filter === "expiring")
      conditions.push(
        "payload->>'expiresAt' < to_char((now()+interval '1 day') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
      );
    if (filter === "failed")
      conditions.push(
        "exists(select 1 from neutronium_jobs j where j.organization_id=neutronium_help_requests.organization_id and j.id::text=neutronium_help_requests.payload->>'workflowId' and j.payload->>'status'='failed')",
      );
    const result = await tenantQuery(
      a.orgId,
      `select payload from neutronium_help_requests where ${conditions.join(" and ")} order by id limit 26`,
      values,
    );
    records = result.rows.map((x) => x.payload);
  }
  const more = records.length > limit;
  records = records.slice(0, limit);
  return {
    items: records.map((r) => ({
      ...r,
      messages: r.messages
        .filter((m) => canAdmin(a) || !m.internal)
        .map((m) => ({
          ...m,
          attachment: m.attachment
            ? { name: m.attachment.name, key: m.attachment.key }
            : undefined,
        })),
    })),
    nextCursor: more ? records[records.length - 1].id : null,
  };
}

/** Scoped operational mutation. Locks the company revision so legacy CAS writers cannot overwrite it. */
export async function mutateServiceRequest(
  a: Actor,
  action: string,
  input: Record<string, unknown>,
) {
  if (a.demo) {
    const { mutate } = await import("./store");
    const { command } = await import("./service");
    return mutate(a.orgId, true, (w) => command(w, a, action, input));
  }
  const { command } = await import("./service");
  const { externalizeAttachments } = await import("./files");
  const client = await tenantConnection(a.orgId);
  try {
    await client.query("begin");
    const org = (
      await client.query(
        "select id,name,revision,metadata from neutronium_organizations where id=$1 for update",
        [a.orgId],
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
      requests: [],
      jobs: [],
      grants: [],
      audit: [],
      notifications: [],
      integrations: [],
      helpRequests: [],
    } as import("./model").Workspace;
    if (input.id) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(input.id),
        )
      )
        throw new DomainError("Invalid request ID.");
      w.helpRequests = (
        await client.query(
          "select payload from neutronium_help_requests where organization_id=$1 and id=$2",
          [a.orgId, input.id],
        )
      ).rows.map((x) => x.payload);
    }
    for (const bucket of ["employees", "applications"] as const)
      w[bucket] = (
        await client.query(
          `select payload from neutronium_${bucket} where organization_id=$1`,
          [a.orgId],
        )
      ).rows.map((x) => x.payload);
    const employeeId =
      w.helpRequests?.[0]?.employeeId || input.employeeId || a.employeeId;
    if (employeeId)
      for (const bucket of ["requests", "jobs", "grants"] as const)
        w[bucket] = (
          await client.query(
            `select payload from neutronium_${bucket} where organization_id=$1 and employee_id=$2`,
            [a.orgId, employeeId],
          )
        ).rows.map((x) => x.payload);
    const before = structuredClone(w);
    const result = command(w, a, action, input);
    await externalizeAttachments(w);
    for (const [key, bucket] of [
      ["helpRequests", "help_requests"],
      ["requests", "requests"],
      ["jobs", "jobs"],
      ["grants", "grants"],
      ["audit", "audit"],
      ["notifications", "notifications"],
    ] as const) {
      for (const item of w[key] || []) {
        const previous = before[key]?.find((x) => x.id === item.id);
        if (JSON.stringify(previous) === JSON.stringify(item)) continue;
        if (bucket === "audit")
          await client.query(
            "insert into neutronium_audit(organization_id,id,payload) values($1,$2,$3)",
            [a.orgId, item.id, JSON.stringify(item)],
          );
        else
          await client.query(
            `insert into neutronium_${bucket}(organization_id,id,payload) values($1,$2,$3) on conflict(organization_id,id) do update set payload=excluded.payload`,
            [a.orgId, item.id, JSON.stringify(item)],
          );
      }
    }
    const metadata = {
      ...org.metadata,
      checklistTemplates: w.checklistTemplates || [],
      savedViews: w.savedViews || [],
    };
    await client.query(
      "update neutronium_organizations set revision=revision+1,metadata=$2 where id=$1",
      [a.orgId, JSON.stringify(metadata)],
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
export async function readServiceRequest(a: Actor, id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new DomainError("Request not found.", 404);
  if (a.demo) return readWorkspace(a.orgId, true);
  const records = await tenantQuery(
    a.orgId,
    "select payload from neutronium_help_requests where organization_id=$1 and id=$2",
    [a.orgId, id],
  );
  return {
    id: a.orgId,
    helpRequests: records.rows.map((x) => x.payload),
  } as import("./model").Workspace;
}

export async function serviceRequestContext(a: Actor, id: string) {
  const w = await readServiceRequest(a, id);
  const request = w.helpRequests?.find((r) => r.id === id);
  if (!request || !visibleRequest(request, a))
    throw new DomainError("Request not found.", 404);
  if (!canAdmin(a)) return { requests: [], jobs: [] };
  if (a.demo)
    return {
      requests: w.requests.filter((r) => r.employeeId === request.employeeId),
      jobs: w.jobs.filter((j) => j.employeeId === request.employeeId),
    };
  const results = await Promise.all(
    ["requests", "jobs"].map((bucket) =>
      tenantQuery(
        a.orgId,
        `select payload from neutronium_${bucket} where organization_id=$1 and employee_id=$2 order by created_at desc`,
        [a.orgId, request.employeeId],
      ),
    ),
  );
  return {
    requests: results[0].rows.map((r) => r.payload),
    jobs: results[1].rows.map((r) => r.payload),
  };
}
