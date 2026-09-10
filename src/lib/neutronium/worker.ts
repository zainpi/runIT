import { workerMutation, readWorkerState } from "./worker-store";
import { claimNotification, finishNotification } from "./notification-store";
import { tenantQuery } from "./postgres";
import { remindOperations } from "./operations";
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
import { mutate, readWorkspace } from "./store";
import { executeStep, MicrosoftProvider } from "./providers";
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
  remindOperations(w);
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
  const claimed = local
    ? await mutate(orgId, true, claim)
    : await workerMutation(orgId, claim);
  if (!claimed) return false;
  const { job, step } = claimed;
  const update = <T>(fn: (w: Workspace) => T) =>
    local ? mutate(orgId, true, fn) : workerMutation(orgId, fn, job.id);
  try {
    let w = local
      ? await readWorkspace(orgId, true)
      : await readWorkerState(orgId, job.id);
    const application = w.applications.find((a) => a.id === step.applicationId);
    const groupId = step.operation.startsWith("group:")
      ? step.operation.slice(6)
      : ["grant", "application"].includes(step.operation) &&
          application?.mode === "microsoft"
        ? application.groupId
        : undefined;
    if (!w.demo && groupId && !step.membershipIntent) {
      const e = w.employees.find((e) => e.id === job.employeeId)!;
      if (!e.providerId)
        throw new DomainError("Employee has no matched Microsoft identity.");
      const p = new MicrosoftProvider(w);
      await p.validateGroup(groupId);
      const member = await p.membership(groupId, e.providerId);
      if (member.absent)
        await update((state) => {
          const current = state.jobs
            .find((j) => j.id === job.id)!
            .steps.find((s) => s.id === step.id)!;
          if (current.lease !== step.lease || current.status !== "running")
            throw new DomainError("Worker lease changed.", 409);
          current.membershipIntent = {
            groupId,
            userId: e.providerId!,
            absentAt: now(),
          };
        });
      w = local
        ? await readWorkspace(orgId, true)
        : await readWorkerState(orgId, job.id);
    }
    const result = await executeStep(w, job, step);
    await update((state) => {
      const currentJob = state.jobs.find((j) => j.id === job.id)!;
      const current = currentJob.steps.find((s) => s.id === step.id)!;
      if (current.lease !== step.lease || current.status !== "running") return;
      current.status = result.status;
      current.providerRef = result.reference;
      current.error = result.note;
      current.evidence = result.evidence;
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
        if (request?.expiresAt) grant.expiresAt = request.expiresAt;
        grant.providerRef = result.reference;
        grant.evidence = result.evidence;
        current.grantId = grant.id;
      }
      if (step.operation.startsWith("revoke:")) {
        const grant = state.grants.find(
          (g) => g.id === step.operation.slice(7),
        );
        if (grant) {
          grant.status = result.status === "success" ? "revoked" : "revoking";
          grant.evidence = result.evidence;
          current.grantId = grant.id;
        }
      }
      if (step.operation === "license" && result.status === "success")
        e.mailbox = { status: "pending" };
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
    await update((w) => {
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
        Date.now() +
          Math.max(
            error instanceof DomainError ? error.retryAfterMs || 0 : 0,
            Math.min(300_000, 1000 * 2 ** s.attempts) +
              Math.floor(Math.random() * 1000),
          ),
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
  for (let i = 0; i < 10; i++) {
    const configured = emailConfigured();
    const n = await claimNotification(orgId, configured);
    if (!n) break;
    if (!configured) {
      await finishNotification(orgId, n.id, n.deliveryLease, "unconfigured");
      continue;
    }
    try {
      let addresses: string[] = [];
      if (n.recipientId === "admins") {
        const { rows } = await tenantQuery(
          orgId,
          "select u.email from neutronium_memberships m join neutronium_users u on u.id=m.user_id where m.organization_id=$1 and m.active and m.role in ('ORG_OWNER','ORG_ADMIN') and u.verified",
          [orgId],
        );
        addresses = rows.map((r) => r.email);
      } else {
        const { rows } = await tenantQuery(
          orgId,
          "select payload->>'email' as email from neutronium_employees where organization_id=$1 and id::text=$2",
          [orgId, n.recipientId],
        );
        addresses = rows.map((r) => r.email);
        if (!addresses.length) {
          const { rows } = await tenantQuery(
            orgId,
            "select u.email from neutronium_users u join neutronium_memberships m on m.user_id=u.id where m.organization_id=$1 and m.user_id::text=$2 and m.active and u.verified",
            [orgId, n.recipientId],
          );
          addresses = rows.map((r) => r.email);
        }
      }
      if (!addresses.length) {
        await finishNotification(orgId, n.id, n.deliveryLease, "failed");
        continue;
      }
      await sendEmail({
        from: process.env.NEUTRONIUM_EMAIL_FROM!,
        to: [...new Set(addresses)],
        subject: `Neutronium · ${n.title}`,
        text: `${n.body}\n\nOpen your workspace: ${process.env.NEUTRONIUM_APP_URL}/neutronium`,
        idempotencyKey: n.id,
      });
      await finishNotification(orgId, n.id, n.deliveryLease, "sent");
    } catch {
      await finishNotification(orgId, n.id, n.deliveryLease, "pending");
    }
  }
}
