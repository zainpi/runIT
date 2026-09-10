import { Actor } from "./model";
import { pilotReport } from "./operations";
import { readWorkspace } from "./store";
import { tenantQuery } from "./postgres";
export const reportSql = `with requests as (
 select payload from neutronium_help_requests where organization_id=$1 and (payload->>'createdAt')::timestamptz>=now()-interval '30 days'
) select 30 as days,
 (select count(*)::int from requests) as requests,
 (select count(*)::int from requests where (payload->>'dueAt')::timestamptz<now() and coalesce(payload->>'fulfillment',case when payload->>'status'='resolved' then 'completed' else 'open' end) not in ('completed','cancelled')) as overdue,
 (select avg(extract(epoch from ((payload->>'completedAt')::timestamptz-(payload->>'createdAt')::timestamptz))/3600)::float8 from requests where payload->>'completedAt' is not null) as "meanCompletionHours",
 (select count(*)::int from neutronium_grants where organization_id=$1 and (payload->>'expiresAt')::timestamptz<=now() and payload->>'status'<>'revoked') as "unverifiedRemovals",
 (select count(*)::int from neutronium_audit where organization_id=$1 and (payload->>'at')::timestamptz>=now()-interval '30 days' and payload->>'action'='Manual workflow step verified') as "manualActions",
 (select count(*)::int from requests where payload->>'completedAt' is not null and payload->'evidence'->>'kind'='manual') as "manualConfirmations",
 (select count(*)::int from neutronium_grants where organization_id=$1 and payload->'evidence'->>'kind'='provider') as "providerVerifiedGrants"`;
export async function readPilotReport(
  a: Actor,
): Promise<ReturnType<typeof pilotReport>> {
  if (a.demo) return pilotReport(await readWorkspace(a.orgId, true));
  return (await tenantQuery(a.orgId, reportSql, [a.orgId])).rows[0];
}
