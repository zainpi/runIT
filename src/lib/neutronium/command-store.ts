import type { PoolClient } from "pg";
import { Actor, Workspace, DomainError } from "./model";
import { command } from "./service";
import { tenantConnection } from "./postgres";
import { mutate } from "./store";
const buckets = [
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
export async function runCommand(
  a: Actor,
  action: string,
  input: Record<string, unknown>,
) {
  if (a.demo) return mutate(a.orgId, true, (w) => command(w, a, action, input));
  return commandOnClient(await tenantConnection(a.orgId), a, action, input);
}
/** Keep catalogs for domain validation, but load transactional history only for the affected employee. */
export async function commandOnClient(
  client: PoolClient,
  a: Actor,
  action: string,
  input: Record<string, unknown>,
  manageTransaction = true,
) {
  try {
    if (manageTransaction) await client.query("begin");
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
      helpRequests: [],
    } as Workspace;
    for (const bucket of buckets) (w as any)[bucket] = [];
    for (const bucket of [
      "employees",
      "applications",
      "templates",
      "integrations",
    ] as const)
      w[bucket] = (
        await client.query(
          `select payload from neutronium_${bucket} where organization_id=$1`,
          [a.orgId],
        )
      ).rows.map((r) => r.payload);
    let employeeId = input.employeeId || a.employeeId;
    if (["decision", "reply", "retry", "manual-complete"].includes(action)) {
      if (!/^[0-9a-f-]{36}$/i.test(String(input.id || "")))
        throw new DomainError("Invalid record ID.");
      const bucket = ["decision", "reply"].includes(action)
        ? "requests"
        : "jobs";
      const record = (
        await client.query(
          `select payload from neutronium_${bucket} where organization_id=$1 and id=$2`,
          [a.orgId, input.id],
        )
      ).rows[0]?.payload;
      if (!record)
        throw new DomainError("Record not found in this organization.", 404);
      employeeId = record.employeeId;
    }
    if (employeeId) {
      if (!/^[0-9a-f-]{36}$/i.test(String(employeeId)))
        throw new DomainError("Invalid employee ID.");
      for (const bucket of ["requests", "jobs", "grants"] as const)
        w[bucket] = (
          await client.query(
            `select payload from neutronium_${bucket} where organization_id=$1 and employee_id=$2`,
            [a.orgId, employeeId],
          )
        ).rows.map((r) => r.payload);
    }
    if (action === "notification-retry") {
      if (!/^[0-9a-f-]{36}$/i.test(String(input.id || "")))
        throw new DomainError("Invalid notification ID.");
      w.notifications = (
        await client.query(
          "select payload from neutronium_notifications where organization_id=$1 and id=$2",
          [a.orgId, input.id],
        )
      ).rows.map((r) => r.payload);
    }
    if (action === "notifications-read")
      w.notifications = (
        await client.query(
          "select payload from neutronium_notifications where organization_id=$1 and payload->>'recipientId'=any($2::text[]) and coalesce(payload->>'read','false')<>'true'",
          [
            a.orgId,
            [
              a.id,
              a.employeeId || "",
              ...(["ORG_OWNER", "ORG_ADMIN"].includes(a.role)
                ? ["admins"]
                : []),
            ],
          ],
        )
      ).rows.map((r) => r.payload);
    const before = structuredClone(w),
      result = command(w, a, action, input);
    for (const bucket of buckets)
      for (const item of w[bucket]) {
        if (
          JSON.stringify(before[bucket].find((r) => r.id === item.id)) ===
          JSON.stringify(item)
        )
          continue;
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
    const metadata = { ...w } as Record<string, unknown>;
    for (const key of [
      ...buckets,
      "id",
      "name",
      "revision",
      "helpRequests",
      "pageInfo",
      "directoryPageIds",
      "summary",
      "applicationGrantCounts",
      "assignedTestAccounts",
    ])
      delete metadata[key];
    await client.query(
      "update neutronium_organizations set name=$2,metadata=$3,revision=revision+1 where id=$1",
      [a.orgId, w.name, JSON.stringify(metadata)],
    );
    if (manageTransaction) await client.query("commit");
    return result;
  } catch (e) {
    if (manageTransaction) await client.query("rollback");
    throw e;
  } finally {
    if (manageTransaction) client.release();
  }
}
