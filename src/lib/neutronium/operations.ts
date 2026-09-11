import { hasControlCharacters } from "./validation";
import {
  Actor,
  Workspace,
  HelpRequest,
  RequestKind,
  Fulfillment,
  Evidence,
  DomainError,
  canAdmin,
  canManagePeople,
  platformRoles,
  uid,
  now,
  audit,
  notify,
} from "./model";
export const requestKinds: RequestKind[] = [
  "general",
  "onboarding",
  "software",
  "equipment",
  "document",
  "contractor",
  "qa",
  "offboarding",
];
export const fulfillmentStates: Fulfillment[] = [
  "open",
  "waiting_for_requester",
  "waiting_for_admin",
  "in_progress",
  "completed",
  "cancelled",
];
export const viewFilters = [
  "all",
  "mine",
  "unassigned",
  "overdue",
  "waiting_for_admin",
  "expiring",
  "failed",
];
export function text(v: unknown, label: string, required = true, max = 2000) {
  if (
    typeof v !== "string" ||
    v.length > max ||
    hasControlCharacters(v) ||
    (required && !v.trim())
  )
    throw new DomainError(`Enter a valid ${label}.`);
  return v.trim();
}
export function date(v: unknown, required = false) {
  if (!v && !required) return undefined;
  if (typeof v !== "string" || !Number.isFinite(Date.parse(v)))
    throw new DomainError("Enter a valid date.");
  return new Date(v).toISOString();
}
export function evidence(a: Actor, input: Record<string, unknown>): Evidence {
  const performedAt = date(input.performedAt || now(), true)!;
  if (Date.parse(performedAt) > Date.now() + 60000)
    throw new DomainError("Evidence cannot be dated in the future.");
  return {
    kind: "manual",
    performedBy: text(input.performedBy || a.name, "performer"),
    performedAt,
    confirmedBy: a.id,
    confirmedAt: now(),
    provider: text(input.provider, "provider"),
    target: text(input.target, "target"),
    method: text(input.method, "verification method"),
    note: text(input.note, "completion evidence"),
  };
}
export const fulfillment = (r: HelpRequest): Fulfillment =>
  r.fulfillment ||
  (r.status === "resolved"
    ? "completed"
    : r.status === "waiting"
      ? "waiting_for_requester"
      : "open");
export function approval(w: Workspace, r: HelpRequest) {
  const linked = w.requests.find((x) => x.id === r.accessRequestId);
  return linked
    ? ["approved", "fulfilled"].includes(linked.status)
      ? "approved"
      : linked.status === "rejected"
        ? "rejected"
        : "pending"
    : ["software", "contractor"].includes(r.kind || "")
      ? "pending"
      : "not_required";
}
export function visibleRequest(r: HelpRequest, a: Actor) {
  return (
    !platformRoles.includes(a.role) &&
    (canAdmin(a) || r.employeeId === a.employeeId)
  );
}
function employee(w: Workspace, id: unknown) {
  const e = w.employees.find((e) => e.id === id);
  if (!e) throw new DomainError("Employee not found in this company.", 404);
  return e;
}
export function createOperation(
  w: Workspace,
  a: Actor,
  input: Record<string, unknown>,
  requestId: string,
) {
  if (platformRoles.includes(a.role))
    throw new DomainError("Not permitted.", 403);
  const kind = String(input.kind || "general") as RequestKind;
  if (!requestKinds.includes(kind))
    throw new DomainError("Invalid request type.");
  if (["offboarding", "onboarding"].includes(kind) && !canManagePeople(a))
    throw new DomainError("People administrator required.", 403);
  const e = employee(
    w,
    canAdmin(a) ||
      (canManagePeople(a) && ["onboarding", "offboarding"].includes(kind))
      ? input.employeeId || a.employeeId
      : a.employeeId,
  );
  if (!["active", "onboarding", "offboarding"].includes(e.status))
    throw new DomainError("Employee is not available.");
  const priority = String(
    input.priority || "normal",
  ) as HelpRequest["priority"];
  if (!["low", "normal", "high", "urgent"].includes(priority!))
    throw new DomainError("Invalid priority.");
  const ownerId =
    canAdmin(a) && input.ownerId ? employee(w, input.ownerId).id : undefined;
  const expiresAt = date(input.expiresAt, kind === "contractor");
  if (expiresAt && Date.parse(expiresAt) <= Date.now())
    throw new DomainError("Access expiry must be in the future.");
  const applicationId = input.applicationId
    ? w.applications.find((x) => x.id === input.applicationId)?.id
    : undefined;
  if (input.applicationId && !applicationId)
    throw new DomainError("Application not found.", 404);
  if (["software", "contractor"].includes(kind) && !applicationId)
    throw new DomainError("Choose an application.");
  let environmentId: string | undefined;
  if (input.environmentId) {
    const env = w.testEnvironments?.find(
      (x) => x.id === input.environmentId && x.status === "active",
    );
    if (!env) throw new DomainError("Environment not found.", 404);
    environmentId = env.id;
  }
  const template = input.checklistTemplateId
    ? w.checklistTemplates?.find(
        (x) => x.id === input.checklistTemplateId && x.kind === kind,
      )
    : w.checklistTemplates?.find((x) => x.kind === kind);
  if (input.checklistTemplateId && !template)
    throw new DomainError("Checklist template not found.", 404);
  const defaults: Partial<Record<RequestKind, string[]>> = {
    onboarding: [
      "Documents and policy acknowledgement",
      "Required tools and accounts",
      "Secure first sign-in",
    ],
    offboarding: [
      "Contain access",
      "Return equipment",
      "Preserve mailbox and files",
      "Complete handover",
    ],
    qa: ["Assign tester account", "Verify staging access"],
    equipment: ["Arrange delivery or return"],
    document: ["Deliver requested document"],
  };
  const tasks = (
    template?.tasks ||
    (defaults[kind] || []).map((title) => ({ title, required: true }))
  ).map((t) => ({ ...t, id: uid(), ownerId }));
  const r: HelpRequest = {
    id: uid(),
    employeeId: e.id,
    requesterId: a.id,
    kind,
    subject: text(input.subject, "subject", true, 150),
    body: text(input.body, "request", true, 4000),
    status: "open",
    fulfillment: "open",
    priority,
    ownerId,
    dueAt: date(input.dueAt),
    expiresAt,
    applicationId,
    environmentId,
    tasks,
    createdAt: now(),
    updatedAt: now(),
    messages: [],
  };
  (w.helpRequests ||= []).push(r);
  audit(w, a, "Service request created", e.id, requestId, undefined, {
    id: r.id,
    kind,
  });
  notify(w, "admins", r.subject, "A service request needs an owner.");
  return r;
}
export function operationCommand(
  w: Workspace,
  a: Actor,
  action: string,
  input: Record<string, unknown>,
  requestId: string,
) {
  if (action === "checklist-template") {
    if (!canAdmin(a)) throw new DomainError("Administrator required.", 403);
    const kind = String(input.kind) as RequestKind;
    if (!requestKinds.includes(kind))
      throw new DomainError("Invalid request type.");
    if (
      !Array.isArray(input.tasks) ||
      !input.tasks.length ||
      input.tasks.length > 30
    )
      throw new DomainError("Add 1–30 checklist tasks.");
    const tasks = input.tasks.map((t) => ({
      title: text(t.title, "task", true, 200),
      required: t.required !== false,
    }));
    const existing = w.checklistTemplates?.find((t) => t.id === input.id);
    if (input.id && !existing)
      throw new DomainError("Template not found.", 404);
    const next = {
      id: existing?.id || uid(),
      name: text(input.name, "template name", true, 100),
      kind,
      tasks,
    };
    if (existing) Object.assign(existing, next);
    else (w.checklistTemplates ||= []).push(next);
    audit(w, a, "Checklist template saved", next.id, requestId);
    return next.id;
  }
  if (action === "saved-view") {
    const filter = String(input.filter);
    if (!viewFilters.includes(filter)) throw new DomainError("Invalid filter.");
    const v = {
      id: uid(),
      actorId: a.id,
      name: text(input.name, "view name", true, 80),
      filter,
    };
    if ((w.savedViews || []).filter((x) => x.actorId === a.id).length >= 20)
      throw new DomainError("Maximum 20 saved views.");
    (w.savedViews ||= []).push(v);
    return v.id;
  }
  const r = w.helpRequests?.find((r) => r.id === input.id);
  if (!r || !visibleRequest(r, a))
    throw new DomainError("Request not found.", 404);
  if (!canAdmin(a)) throw new DomainError("Administrator required.", 403);
  if (action === "operation-note") {
    if (r.messages.length >= 100)
      throw new DomainError("This conversation has reached its limit.");
    r.messages.push({
      id: uid(),
      author: a.name,
      body: text(input.body, "internal note", true, 4000),
      at: now(),
      internal: true,
    });
    audit(w, a, "Internal service note added", r.id, requestId);
    return r.id;
  }
  if (action === "operation-task") {
    const task = r.tasks?.find((t) => t.id === input.taskId);
    if (!task) throw new DomainError("Task not found.", 404);
    if (fulfillment(r) === "completed")
      throw new DomainError("Reopen the request before changing tasks.");
    if (input.completed === true) {
      task.evidence = evidence(a, input);
      task.completedAt = now();
    } else {
      delete task.evidence;
      delete task.completedAt;
    }
    if (input.ownerId !== undefined)
      task.ownerId = input.ownerId ? employee(w, input.ownerId).id : undefined;
    if (input.dueAt !== undefined) task.dueAt = date(input.dueAt);
    audit(w, a, "Checklist task updated", r.id, requestId, undefined, {
      taskId: task.id,
      completedAt: task.completedAt,
      evidence: task.evidence,
    });
    return r.id;
  }
  if (action !== "operation-update")
    throw new DomainError("Unknown operation.");
  const next = String(input.fulfillment || fulfillment(r)) as Fulfillment;
  if (!fulfillmentStates.includes(next))
    throw new DomainError("Invalid fulfillment state.");
  if (
    fulfillment(r) === "completed" &&
    next === "completed" &&
    (input.workflowId ||
      input.accessRequestId ||
      input.testerAccountId ||
      (input.environmentId && input.environmentId !== r.environmentId))
  )
    throw new DomainError(
      "Reopen the request before changing its linked fulfillment records.",
    );
  if (
    next === "cancelled" &&
    r.accessRequestId &&
    w.requests.some(
      (x) => x.id === r.accessRequestId && x.status !== "rejected",
    )
  )
    throw new DomainError(
      "Resolve the linked access request before cancelling service fulfillment; cancellation does not remove provider access.",
    );
  if (
    next === "cancelled" &&
    r.workflowId &&
    w.jobs.some((x) => x.id === r.workflowId && x.status !== "success")
  )
    throw new DomainError(
      "The linked lifecycle workflow is still active and cannot be cancelled here.",
    );
  if (input.accessRequestId) {
    const link = w.requests.find(
      (x) =>
        x.id === input.accessRequestId &&
        x.employeeId === r.employeeId &&
        x.applicationId === r.applicationId,
    );
    if (!link || (r.kind === "contractor" && link.expiresAt !== r.expiresAt))
      throw new DomainError("Matching access request not found.", 404);
    r.accessRequestId = link.id;
  }
  if (input.workflowId) {
    const link = w.jobs.find(
      (x) =>
        x.id === input.workflowId &&
        x.employeeId === r.employeeId &&
        ((r.kind === "onboarding" && x.kind === "onboard") ||
          (r.kind === "offboarding" && x.kind === "offboard")),
    );
    if (!link)
      throw new DomainError("Matching lifecycle workflow not found.", 404);
    r.workflowId = link.id;
  }
  if (input.environmentId) {
    const env = w.testEnvironments?.find(
      (e) => e.id === input.environmentId && e.status === "active",
    );
    if (!env) throw new DomainError("Environment not found.", 404);
    if (r.environmentId !== env.id) delete r.testerAccountId;
    r.environmentId = env.id;
  }
  if (input.testerAccountId) {
    const env = w.testEnvironments?.find(
      (x) => x.id === r.environmentId && x.status === "active",
    );
    const account = env?.accounts.find(
      (x) =>
        x.id === input.testerAccountId &&
        x.employeeId === r.employeeId &&
        x.status === "active",
    );
    if (!account)
      throw new DomainError(
        "Choose an active account assigned to this employee.",
        404,
      );
    r.testerAccountId = account.id;
  }
  if (next === "completed" && fulfillment(r) !== "completed") {
    if (r.tasks?.some((t) => t.required && !t.completedAt))
      throw new DomainError("Complete all required checklist tasks first.");
    if (["software", "contractor"].includes(r.kind || "")) {
      const linked = w.requests.find((x) => x.id === r.accessRequestId);
      if (!linked || linked.status !== "fulfilled")
        throw new DomainError(
          "Approved access must be fulfilled through the access workflow first.",
        );
    }
    if (
      ["onboarding", "offboarding"].includes(r.kind || "") &&
      !w.jobs.some((j) => j.id === r.workflowId && j.status === "success")
    )
      throw new DomainError("Link a completed lifecycle workflow first.");
    if (r.kind === "qa" && !r.testerAccountId)
      throw new DomainError("Assign a tester account first.");
    r.evidence = evidence(a, input);
    r.completedAt = now();
  }
  if (next !== "completed") delete r.completedAt;
  if (input.ownerId !== undefined)
    r.ownerId = input.ownerId ? employee(w, input.ownerId).id : undefined;
  if (input.dueAt !== undefined) r.dueAt = date(input.dueAt);
  if (input.priority !== undefined) {
    if (!["low", "normal", "high", "urgent"].includes(String(input.priority)))
      throw new DomainError("Invalid priority.");
    r.priority = input.priority as HelpRequest["priority"];
  }
  r.fulfillment = next;
  r.status =
    next === "completed" || next === "cancelled"
      ? "resolved"
      : next === "waiting_for_requester"
        ? "waiting"
        : "open";
  r.updatedAt = now();
  audit(w, a, "Service fulfillment updated", r.id, requestId, undefined, {
    fulfillment: next,
    evidence: r.evidence,
  });
  return r.id;
}
export function remindOperations(w: Workspace) {
  const time = Date.now();
  for (const r of w.helpRequests || []) {
    if (["completed", "cancelled"].includes(fulfillment(r))) continue;
    const reason =
      r.dueAt && Date.parse(r.dueAt) < time
        ? "overdue"
        : r.expiresAt && Date.parse(r.expiresAt) < time + 86400000
          ? "expiring"
          : undefined;
    if (!reason) continue;
    const key = `request:${r.id}:${reason}:${new Date().toISOString().slice(0, 10)}`;
    if (w.notifications.some((n) => n.dedupeKey === key)) continue;
    notify(w, r.ownerId || "admins", `Request ${reason}`, r.subject);
    w.notifications[w.notifications.length - 1].dedupeKey = key;
  }
}
export function pilotReport(w: Workspace, days = 30) {
  const since = Date.now() - days * 86400000;
  const requests = (w.helpRequests || []).filter(
    (r) => Date.parse(r.createdAt) >= since,
  );
  const completed = requests.filter((r) => r.completedAt);
  return {
    days,
    requests: requests.length,
    overdue: requests.filter(
      (r) =>
        r.dueAt &&
        Date.parse(r.dueAt) < Date.now() &&
        !["completed", "cancelled"].includes(fulfillment(r)),
    ).length,
    meanCompletionHours: completed.length
      ? completed.reduce(
          (n, r) =>
            n +
            (Date.parse(r.completedAt!) - Date.parse(r.createdAt)) / 3600000,
          0,
        ) / completed.length
      : null,
    unverifiedRemovals: w.grants.filter(
      (g) =>
        g.expiresAt &&
        Date.parse(g.expiresAt) <= Date.now() &&
        g.status !== "revoked",
    ).length,
    manualActions: w.audit.filter(
      (e) =>
        Date.parse(e.at) >= since &&
        e.action === "Manual workflow step verified",
    ).length,
    manualConfirmations: completed.filter((r) => r.evidence?.kind === "manual")
      .length,
    providerVerifiedGrants: w.grants.filter(
      (g) => g.evidence?.kind === "provider",
    ).length,
  };
}
