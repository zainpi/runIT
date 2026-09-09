import { accountById } from "./accounts";
import { emailConfigured, sendEmail } from "./email";
import {
  Actor,
  Workspace,
  Job,
  Step,
  DomainError,
  uid,
  now,
  audit,
  notify,
  fullName,
  steps,
} from "./model";
import { mutate, readWorkspace, db } from "./store";
import { executeStep } from "./providers";
import { newGrant } from "./service";
function system(w: Workspace): Actor {
  return {
    id: "scheduler",
    name: "Neutronium worker",
    role: "ORG_OWNER",
    orgId: w.id,
    demo: w.demo,
  };
}
export function scheduleExpirations(w: Workspace) {
  for (const g of w.grants) {
    if (
      ["active", "manual_required"].includes(g.status) &&
      g.expiresAt &&
      Date.parse(g.expiresAt) <= Date.now() &&
      !w.jobs.some(
        (j) =>
          j.kind === "revoke" &&
          j.steps.some((s) => s.operation === `revoke:${g.id}`),
      )
    ) {
      g.status = "revoking";
      w.jobs.push({
        id: uid(),
        employeeId: g.employeeId,
        kind: "revoke",
        status: "pending",
        createdAt: now(),
        scheduledAt: now(),
        steps: steps([
          [
            `Expire ${w.applications.find((a) => a.id === g.applicationId)?.name} ${g.level}`,
            `revoke:${g.id}`,
            g.applicationId,
          ],
        ]),
      });
      audit(
        w,
        system(w),
        "Temporary access expiration queued",
        g.employeeId,
        uid(),
        undefined,
        { grantId: g.id },
      );
    }
  }
}
export function claim(w: Workspace): { job: Job; step: Step } | null {
  scheduleExpirations(w);
  for (const job of w.jobs) {
    if (
      !["pending", "running"].includes(job.status) ||
      Date.parse(job.scheduledAt) > Date.now()
    )
      continue;
    const step = job.steps.find(
      (s) => !["success", "skipped"].includes(s.status),
    );
    if (!step) {
      job.status = "success";
      const e = w.employees.find((e) => e.id === job.employeeId)!;
      if (job.kind === "onboard") e.status = "active";
      if (job.kind === "offboard") e.status = "terminated";
      const r = w.requests.find((r) => r.id === job.requestId);
      if (r) r.status = "fulfilled";
      audit(w, system(w), `${job.kind} workflow completed`, e.id, job.id);
      notify(
        w,
        job.kind === "onboard" ? "admins" : e.id,
        "Workflow completed",
        `${fullName(e)} · ${job.kind}`,
      );
      continue;
    }
    if (step.status === "manual_required") {
      job.status = "manual_required";
      continue;
    }
    if (step.status === "failed") {
      job.status = "failed";
      continue;
    }
    if (
      step.status === "running" &&
      step.leaseUntil &&
      Date.parse(step.leaseUntil) > Date.now()
    )
      continue;
    if (step.nextAttemptAt && Date.parse(step.nextAttemptAt) > Date.now())
      continue;
    step.status = "running";
    step.attempts++;
    step.lease = uid();
    step.leaseUntil = new Date(Date.now() + 120_000).toISOString();
    job.status = "running";
    return { job: structuredClone(job), step: structuredClone(step) };
  }
  return null;
}
export async function tick(orgId: string, local = false) {
  const claimed = await mutate(orgId, local, claim);
  if (!claimed) return false;
  const { job, step } = claimed;
  try {
    const w = await readWorkspace(orgId, local);
    const result = await executeStep(w, job, step);
    await mutate(orgId, local, (state) => {
      const currentJob = state.jobs.find((j) => j.id === job.id)!;
      const current = currentJob.steps.find((s) => s.id === step.id)!;
      if (current.lease !== step.lease || current.status !== "running") return;
      current.status = result.status;
      current.providerRef = result.reference;
      current.error = result.note;
      delete current.leaseUntil;
      const e = state.employees.find((e) => e.id === job.employeeId)!;
      if (step.operation === "identity" && result.reference)
        e.providerId = result.reference;
      if (step.operation === "application" || step.operation === "grant") {
        const request = state.requests.find((r) => r.id === job.requestId);
        const grant = newGrant(
          state,
          e.id,
          step.applicationId!,
          request?.level || "Standard",
          request ? request.id : job.id,
          request?.durationMinutes || 0,
        );
        grant.status =
          result.status === "manual_required" ? "manual_required" : "active";
        grant.providerRef = result.reference;
        current.grantId = grant.id;
      }
      if (step.operation.startsWith("revoke:")) {
        const grant = state.grants.find(
          (g) => g.id === step.operation.slice(7),
        );
        if (grant) {
          grant.status = result.status === "success" ? "revoked" : "revoking";
          current.grantId = grant.id;
        }
      }
      if (step.operation === "terminate") e.status = "terminated";
      if (result.status === "manual_required") {
        currentJob.status = "manual_required";
        notify(
          state,
          "admins",
          "Manual action required",
          `${fullName(e)} · ${step.name}`,
        );
      }
      audit(
        state,
        system(state),
        step.name,
        e.id,
        job.id,
        undefined,
        { status: result.status, reference: result.reference },
        result.status,
      );
    });
  } catch (error) {
    await mutate(orgId, local, (w) => {
      const j = w.jobs.find((j) => j.id === job.id)!;
      const s = j.steps.find((s) => s.id === step.id)!;
      if (s.lease !== step.lease || s.status !== "running") return;
      const transient = !(error instanceof DomainError) || error.status >= 500;
      s.status = transient && s.attempts < 3 ? "retrying" : "failed";
      s.error =
        error instanceof DomainError
          ? error.message
          : "Provider connection interrupted. Retry after checking connection health.";
      s.nextAttemptAt = new Date(
        Date.now() + Math.min(300_000, 1000 * 2 ** s.attempts),
      ).toISOString();
      delete s.leaseUntil;
      j.status = s.status === "failed" ? "failed" : "pending";
      audit(
        w,
        system(w),
        "Workflow step failed",
        j.employeeId,
        j.id,
        undefined,
        { step: s.name, error: s.error },
        "failed",
      );
      notify(w, "admins", "Workflow needs attention", `${s.name}: ${s.error}`);
    });
  }
  return true;
}
export async function deliverNotifications(orgId: string) {
  const w = await readWorkspace(orgId);
  const pending = w.notifications
    .filter(
      (n) =>
        n.emailStatus === "pending" &&
        (!n.nextAttemptAt || Date.parse(n.nextAttemptAt) <= Date.now()),
    )
    .slice(0, 10);
  for (const n of pending) {
    if (
      !emailConfigured()
    ) {
      await mutate(orgId, false, (s) => {
        const found = s.notifications.find((v) => v.id === n.id);
        if (found) found.emailStatus = "unconfigured";
      });
      continue;
    }
    const addresses: string[] = [];
    if (n.recipientId === "admins") {
      const { data } = await db()
        .from("neutronium_memberships")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("active", true)
        .in("role", ["ORG_OWNER", "ORG_ADMIN"]);
      for (const member of data || []) {
        const user = await accountById(member.user_id);
        if (user?.email) addresses.push(user.email);
      }
    } else {
      const e = w.employees.find((e) => e.id === n.recipientId);
      if (e) addresses.push(e.email);
    }
    if (!addresses.length) continue;
    let sent = false;
    try {
      await sendEmail({
        from: process.env.NEUTRONIUM_EMAIL_FROM!,
        to: addresses,
        subject: `Neutronium · ${n.title}`,
        text: `${n.body}\n\nOpen your workspace: ${process.env.NEUTRONIUM_APP_URL}/neutronium`,
        idempotencyKey: n.id,
      });
      sent = true;
    } catch {
      sent = false;
    }
    await mutate(orgId, false, (s) => {
      const found = s.notifications.find((v) => v.id === n.id);
      if (found) {
        found.emailStatus = sent ? "sent" : "pending";
        found.attempts = (found.attempts || 0) + 1;
        found.nextAttemptAt = new Date(
          Date.now() + Math.min(86400_000, 60_000 * 2 ** found.attempts),
        ).toISOString();
      }
    });
  }
}
