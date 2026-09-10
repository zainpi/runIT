import {
  Actor,
  Workspace,
  DomainError,
  canAdmin,
  now,
  audit,
  uid,
} from "./model";
import { MicrosoftProvider, Feature } from "./providers";
import { mutate, readWorkspace } from "./store";
export async function graphPages(
  p: MicrosoftProvider,
  path: string,
  feature: Feature,
) {
  const base = path.split("?")[0];
  const records: any[] = [];
  let page = path;
  const seen = new Set<string>();
  while (page) {
    if (seen.has(page) || seen.size >= 100)
      throw new DomainError(
        "Provider pagination was incomplete. Previous verified data is preserved.",
        503,
      );
    seen.add(page);
    const result = await p.graph(page, feature);
    if (!Array.isArray(result.value))
      throw new DomainError("Provider returned an incomplete collection.", 503);
    records.push(...result.value);
    const next = result["@odata.nextLink"];
    if (next) {
      const u = new URL(next);
      if (
        u.origin !== "https://graph.microsoft.com" ||
        u.pathname !== `/v1.0${base}`
      )
        throw new DomainError("Unexpected provider pagination URL.");
      page = u.pathname.slice(5) + u.search;
    } else page = "";
  }
  return records;
}
export async function syncReadiness(a: Actor) {
  if (!canAdmin(a) || a.demo)
    throw new DomainError("Connect a production Microsoft tenant first.");
  const w = await readWorkspace(a.orgId);
  const p = new MicrosoftProvider(w);
  const domains = await graphPages(p, "/domains", "readiness");
  const skus = await graphPages(p, "/subscribedSkus", "readiness");
  const dns: Record<string, unknown[]> = {};
  for (const d of domains.slice(0, 20)) {
    dns[d.id] = await graphPages(
      p,
      `/domains/${encodeURIComponent(d.id)}/serviceConfigurationRecords`,
      "readiness",
    );
    if (!d.isVerified)
      dns[d.id].push(
        ...(await graphPages(
          p,
          `/domains/${encodeURIComponent(d.id)}/verificationDnsRecords`,
          "readiness",
        )),
      );
  }
  await mutate(a.orgId, false, (s) => {
    s.microsoftReadiness = {
      checkedAt: now(),
      domains: domains.map((d) => ({
        id: d.id,
        isVerified: d.isVerified === true,
      })),
      skus: skus.map((k) => ({
        id: k.skuId,
        name: k.skuPartNumber,
        available: Math.max(0, k.prepaidUnits.enabled - k.consumedUnits),
        exchange:
          k.servicePlans?.some(
            (p: { servicePlanName: string; provisioningStatus: string }) =>
              p.servicePlanName.startsWith("EXCHANGE_S_") &&
              p.provisioningStatus === "Success",
          ) || false,
      })),
      dns,
    };
    audit(s, a, "Microsoft readiness checked", s.id, uid());
  });
}
export async function reconcile(a: Actor) {
  if (!canAdmin(a) || a.demo)
    throw new DomainError("Connect a production Microsoft tenant first.");
  const w = await readWorkspace(a.orgId);
  const attemptedAt = now();
  await mutate(a.orgId, false, (s) => {
    s.reconciliation = {
      ...s.reconciliation,
      attemptedAt,
      status: "running",
      findings: s.reconciliation?.findings || [],
    };
  });
  try {
    const p = new MicrosoftProvider(w),
      findings: NonNullable<Workspace["reconciliation"]>["findings"] = [];
    let coverage = 0;
    for (const app of w.applications.filter(
      (a) => a.mode === "microsoft" && a.groupId,
    )) {
      await p.validateGroup(app.groupId!);
      const members = await graphPages(
        p,
        `/groups/${app.groupId}/members?$select=id`,
        "groups",
      );
      const ids = new Set(members.map((m) => m.id));
      coverage++;
      for (const e of w.employees.filter((e) => e.providerId)) {
        const expected = w.grants.some(
          (g) =>
            g.employeeId === e.id &&
            g.applicationId === app.id &&
            g.status === "active",
        );
        const actual = ids.has(e.providerId);
        if (expected !== actual)
          findings.push({
            employeeId: e.id,
            applicationId: app.id,
            type: actual ? "unexpected" : "missing",
            at: now(),
          });
      }
    }
    await mutate(a.orgId, false, (s) => {
      if (s.reconciliation?.attemptedAt !== attemptedAt) return;
      s.reconciliation = {
        attemptedAt,
        succeededAt: now(),
        status: "complete",
        coverage,
        findings,
      };
      audit(s, a, "Configured access reconciled", s.id, uid(), undefined, {
        coverage,
        findings: findings.length,
      });
    });
  } catch (e) {
    await mutate(a.orgId, false, (s) => {
      if (s.reconciliation?.attemptedAt === attemptedAt) {
        s.reconciliation.status = "failed";
        s.reconciliation.error =
          e instanceof DomainError
            ? e.message
            : "Microsoft synchronization failed.";
      }
    });
    throw e;
  }
}
