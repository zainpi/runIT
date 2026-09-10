import { tenantConnection } from "./postgres";
import { Notification, uid } from "./model";
export async function claimNotification(orgId: string, configured: boolean) {
  const client = await tenantConnection(orgId);
  try {
    await client.query("begin");
    await client.query(
      "select revision from neutronium_organizations where id=$1 for update",
      [orgId],
    );
    const row = (
      await client.query(
        "select payload from neutronium_notifications where organization_id=$1 and (payload->>'emailStatus'='pending' or ($2 and payload->>'emailStatus'='unconfigured')) and coalesce((payload->>'nextAttemptAt')::timestamptz,'-infinity')<=now() and coalesce((payload->>'deliveryLeaseUntil')::timestamptz,'-infinity')<=now() order by created_at,id limit 1 for update skip locked",
        [orgId, configured],
      )
    ).rows[0];
    if (!row) {
      await client.query("commit");
      return null;
    }
    const n = row.payload as Notification;
    const claim = {
      ...n,
      deliveryLease: uid(),
      deliveryLeaseUntil: new Date(Date.now() + 120000).toISOString(),
    };
    await client.query(
      "update neutronium_notifications set payload=$3 where organization_id=$1 and id=$2",
      [orgId, n.id, JSON.stringify(claim)],
    );
    await client.query(
      "update neutronium_organizations set revision=revision+1 where id=$1",
      [orgId],
    );
    await client.query("commit");
    return claim;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
export async function finishNotification(
  orgId: string,
  id: string,
  lease: string,
  status: Notification["emailStatus"],
) {
  const client = await tenantConnection(orgId);
  try {
    await client.query("begin");
    await client.query(
      "select revision from neutronium_organizations where id=$1 for update",
      [orgId],
    );
    const row = (
      await client.query(
        "select payload from neutronium_notifications where organization_id=$1 and id=$2 and payload->>'deliveryLease'=$3 for update",
        [orgId, id, lease],
      )
    ).rows[0];
    if (row) {
      const n = row.payload as Notification;
      delete n.deliveryLease;
      delete n.deliveryLeaseUntil;
      n.attempts = (n.attempts || 0) + 1;
      n.emailStatus =
        status === "pending" && n.attempts >= 5 ? "failed" : status;
      n.nextAttemptAt = new Date(
        Date.now() + Math.min(86400000, 60000 * 2 ** n.attempts),
      ).toISOString();
      await client.query(
        "update neutronium_notifications set payload=$3 where organization_id=$1 and id=$2",
        [orgId, id, JSON.stringify(n)],
      );
      await client.query(
        "update neutronium_organizations set revision=revision+1 where id=$1",
        [orgId],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
