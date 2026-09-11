import { countryCode } from "./country";
import { hasControlCharacters, isCalendarDate, isHttpsUrl } from "./validation";
import {
  createOperation,
  operationCommand,
  evidence,
  fulfillment,
} from "./operations";
import {
  Actor,
  Workspace,
  DomainError,
  Employee,
  Template,
  Grant,
  admins,
  platformRoles,
  requireRole,
  uid,
  now,
  fullName,
  audit,
  notify,
  steps,
  mayApprove,
} from "./model";
type Input = Record<string, unknown>;
function str(v: unknown, label: string, required = true, max = 200) {
  if (
    typeof v !== "string" ||
    v.length > max ||
    hasControlCharacters(v) ||
    (required && !v.trim())
  )
    throw new DomainError(`Enter a valid ${label}.`);
  return v.trim();
}
function directoryUrl(v: unknown, required = true) {
  const value = str(v ?? "", "URL", required, 2000);
  if (!value) return "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DomainError("Enter a complete HTTPS URL.");
  }
  if (!isHttpsUrl(value))
    throw new DomainError("Use an HTTPS URL without embedded credentials.");
  return url.toString();
}
function arr(v: unknown): string[] {
  if (
    !Array.isArray(v) ||
    v.length > 50 ||
    v.some((s) => typeof s !== "string" || s.length > 100)
  )
    throw new DomainError("Invalid selection.");
  return [...new Set(v)];
}
function email(v: unknown) {
  const s = str(v, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    throw new DomainError("Enter a valid email address.");
  return s;
}
function find<T extends { id: string }>(list: T[], id: unknown) {
  const item = list.find((x) => x.id === id);
  if (!item)
    throw new DomainError("Record not found in this organization.", 404);
  return item;
}
function schedule(v: unknown) {
  if (v !== undefined && typeof v !== "string")
    throw new DomainError("Invalid schedule date.");
  const s = typeof v === "string" && v ? new Date(v) : new Date();
  if (isNaN(s.getTime())) throw new DomainError("Invalid schedule date.");
  return s.toISOString();
}
export function command(
  w: Workspace,
  a: Actor,
  action: string,
  input: Input,
  requestId = uid(),
): unknown {
  if (a.orgId !== w.id) throw new DomainError("Organization mismatch.", 403);
  if (platformRoles.includes(a.role) && action !== "support-note")
    throw new DomainError(
      "Operator roles cannot change customer identities.",
      403,
    );
  switch (action) {
    case "test-environment-save": {
      requireRole(a, admins);
      const existing = input.id
        ? find(w.testEnvironments || [], input.id)
        : undefined;
      if (!existing && (w.testEnvironments || []).length >= 100)
        throw new DomainError("A workspace can hold up to 100 environments.");
      const kind = str(input.kind, "environment type");
      const status = str(input.status ?? "active", "status");
      if (
        !["staging", "production", "development"].includes(kind) ||
        !["active", "archived"].includes(status)
      )
        throw new DomainError("Invalid environment type or status.");
      const next = {
        id: existing?.id || uid(),
        name: str(input.name, "environment name", true, 100),
        kind: kind as "staging" | "production" | "development",
        url: directoryUrl(input.url),
        notes: str(input.notes ?? "", "notes", false, 2000),
        status: status as "active" | "archived",
        accounts: existing?.accounts || [],
        updatedAt: now(),
      };
      if (existing) Object.assign(existing, next);
      else (w.testEnvironments ||= []).push(next);
      audit(
        w,
        a,
        existing ? "Test environment updated" : "Test environment created",
        next.id,
        requestId,
        undefined,
        { name: next.name, kind, status },
      );
      return next.id;
    }
    case "tester-account-save": {
      requireRole(a, admins);
      const environment = find(w.testEnvironments || [], input.environmentId);
      if (environment.status === "archived")
        throw new DomainError(
          "Restore this environment before changing its accounts.",
        );
      const existing = input.id
        ? find(environment.accounts, input.id)
        : undefined;
      if (!existing && environment.accounts.length >= 100)
        throw new DomainError(
          "An environment can hold up to 100 tester accounts.",
        );
      const employeeId = str(
        input.employeeId ?? "",
        "assigned employee",
        false,
      );
      if (employeeId && find(w.employees, employeeId).status === "terminated")
        throw new DomainError("Choose an available employee.");
      const status = str(input.status ?? "active", "status");
      if (!["active", "archived"].includes(status))
        throw new DomainError("Invalid account status.");
      const next = {
        id: existing?.id || uid(),
        label: str(input.label, "account label", true, 100),
        username: str(input.username, "username or email", true, 254),
        role: str(input.role ?? "Tester", "account role", true, 100),
        employeeId,
        credentialUrl: directoryUrl(input.credentialUrl, false),
        notes: str(input.notes ?? "", "notes", false, 2000),
        status: status as "active" | "archived",
        updatedAt: now(),
      };
      if (
        environment.accounts.some(
          (account) =>
            account.id !== next.id &&
            account.username.toLowerCase() === next.username.toLowerCase(),
        )
      )
        throw new DomainError(
          "This username is already registered for this environment.",
          409,
        );
      if (existing) Object.assign(existing, next);
      else environment.accounts.push(next);
      environment.updatedAt = now();
      audit(
        w,
        a,
        existing ? "Tester account updated" : "Tester account registered",
        next.id,
        requestId,
        undefined,
        { environmentId: environment.id, status },
      );
      return next.id;
    }
    case "test-employee": {
      requireRole(a, admins);
      if (!w.demo)
        throw new DomainError(
          "Test employees are only available in development workspaces.",
          403,
        );
      const id = uid();
      w.employees.push({
        id,
        firstName: "Test",
        lastName: `Employee ${w.employees.length + 1}`,
        email: `test-${id}@example.invalid`,
        personalEmail: "",
        title: "Test employee",
        department: "Testing",
        managerId: "",
        startDate: now().slice(0, 10),
        location: "",
        employmentType: "Test",
        status: "active",
        createdAt: now(),
      });
      audit(w, a, "Test employee created", id, requestId);
      return id;
    }
    case "help-create": {
      const r = createOperation(w, a, input, requestId);
      if (["software", "contractor"].includes(r.kind || "")) {
        const durationMinutes = r.expiresAt
          ? Math.ceil((Date.parse(r.expiresAt) - Date.now()) / 60000)
          : 0;
        const linked = command(
          w,
          a,
          "request",
          {
            employeeId: r.employeeId,
            applicationId: r.applicationId,
            level: input.level || "Standard",
            durationMinutes,
            reason: r.body,
          },
          requestId,
        ) as string;
        r.accessRequestId = linked;
        if (r.expiresAt)
          w.requests.find((x) => x.id === linked)!.expiresAt = r.expiresAt;
      }
      return r.id;
    }
    case "operation-update":
    case "operation-note":
    case "operation-task":
    case "checklist-template":
    case "saved-view":
      return operationCommand(w, a, action, input, requestId);
    case "help-reply": {
      const r = find(w.helpRequests || [], input.id);
      const admin = admins.includes(a.role);
      if (!admin && r.employeeId !== a.employeeId)
        throw new DomainError("Request not found.", 404);
      const text = str(input.body, "reply", true, 4000);
      let attachment: { name: string; data: string } | undefined;
      if (input.attachment) {
        if (!admin)
          throw new DomainError("Only administrators can attach files.", 403);
        const raw = input.attachment as Record<string, unknown>;
        const name = str(raw.name, "filename", true, 150);
        const data = str(raw.data, "file", true, 70000);
        if (
          !/^[A-Za-z0-9+/]*={0,2}$/.test(data) ||
          data.length % 4 !== 0 ||
          Buffer.from(data, "base64").length > 50000
        )
          throw new DomainError("Files must be at most 50 KB.");
        attachment = { name: name.replace(/[\\/\r\n]/g, "_"), data };
      }
      if (r.messages.length >= 100)
        throw new DomainError("This conversation has reached its limit.");
      const status = admin ? String(input.status || "waiting") : "open";
      if (!["open", "waiting", "resolved"].includes(status))
        throw new DomainError("Invalid request status.");
      r.messages.push({
        id: uid(),
        author: a.name,
        body: text,
        at: now(),
        attachment,
      });
      if (status === "resolved" && r.kind && r.kind !== "general")
        throw new DomainError(
          "Complete this request using fulfillment and evidence.",
        );
      r.status = status as typeof r.status;
      r.fulfillment =
        status === "resolved"
          ? "completed"
          : status === "waiting"
            ? "waiting_for_requester"
            : "open";
      r.updatedAt = now();
      audit(
        w,
        a,
        "Employee help response",
        r.employeeId,
        requestId,
        undefined,
        { id: r.id, status },
      );
      notify(w, admin ? r.employeeId : "admins", r.subject, text);
      return r.id;
    }
    case "onboard": {
      requireRole(a, admins);
      const template = find(w.templates, input.templateId);
      if (!template.active) throw new DomainError("This template is inactive.");
      const companyEmail = email(input.email);
      if (w.employees.some((e) => e.email === companyEmail))
        throw new DomainError("An employee already has this email.", 409);
      const managerId = str(input.managerId ?? "", "manager", false);
      if (managerId) {
        const manager = find(w.employees, managerId);
        if (manager.status !== "active")
          throw new DomainError("Choose an active manager.");
      }
      const startDate = str(input.startDate, "start date");
      if (!isCalendarDate(startDate))
        throw new DomainError("Choose a valid start date.");
      const e: Employee = {
        id: uid(),
        firstName: str(input.firstName, "first name"),
        lastName: str(input.lastName, "last name"),
        email: companyEmail,
        personalEmail: input.personalEmail ? email(input.personalEmail) : "",
        title: str(input.title ?? "", "job title", false),
        department: str(input.department, "department"),
        managerId,
        startDate,
        location: str(input.location ?? "", "location", false),
        usageLocation: input.usageLocation
          ? countryCode(input.usageLocation)
          : undefined,
        employmentType: str(
          input.employmentType ?? "Full-time",
          "employment type",
        ),
        templateId: template.id,
        status: "onboarding",
        createdAt: now(),
      };
      w.employees.push(e);
      const job = {
        id: uid(),
        employeeId: e.id,
        kind: "onboard" as const,
        status: "pending" as const,
        createdAt: now(),
        scheduledAt: now(),
        template: structuredClone(template),
        steps: steps([
          ["Create company identity", "identity"],
          ...(template.licenseId
            ? [["Assign Microsoft 365 license", "license"] as [string, string]]
            : []),
          ...template.groups.map(
            (g) => [`Add to group ${g}`, `group:${g}`] as [string, string],
          ),
          ...template.applications.map(
            (id) =>
              [
                `Grant ${find(w.applications, id).name} access`,
                "application",
                id,
              ] as [string, string, string],
          ),
          ["Prepare employee portal invitation", "invitation"],
        ]),
      };
      w.jobs.push(job);
      audit(w, a, "Employee onboarding started", e.id, requestId, undefined, {
        email: e.email,
        template: template.name,
        jobId: job.id,
      });
      return job.id;
    }
    case "offboard": {
      requireRole(a, [...admins, "HR_ADMIN"]);
      const e = find(w.employees, input.employeeId);
      if (input.confirmation !== e.email)
        throw new DomainError("Type the employee’s company email to confirm.");
      if (
        e.status !== "active" ||
        w.jobs.some(
          (j) =>
            j.employeeId === e.id &&
            j.kind === "offboard" &&
            j.status !== "success",
        )
      )
        throw new DomainError(
          "This employee is not available for offboarding.",
        );
      const pendingGrants = w.jobs.filter(
        (j) =>
          j.employeeId === e.id && j.kind === "grant" && j.status !== "success",
      );
      if (
        pendingGrants.some((j) => j.steps.some((s) => s.status === "running"))
      )
        throw new DomainError(
          "An access change is currently running for this employee. Retry offboarding after it completes.",
          409,
        );
      for (const j of pendingGrants) {
        j.status = "failed";
        for (const s of j.steps)
          if (!["success", "skipped"].includes(s.status)) {
            s.status = "failed";
            s.error = "Cancelled because employee offboarding was scheduled.";
          }
      }
      const at = schedule(input.scheduledAt);
      e.status = "offboarding";
      const job = {
        id: uid(),
        employeeId: e.id,
        kind: "offboard" as const,
        status: "pending" as const,
        createdAt: now(),
        scheduledAt: at,
        template: structuredClone(
          w.templates.find((t) => t.id === e.templateId),
        ),
        steps: steps([
          ["Disable sign-in", "disable"],
          ["Revoke active sessions", "sessions"],
          ...w.grants
            .filter((g) => g.employeeId === e.id && g.status !== "revoked")
            .map(
              (g) =>
                [
                  `Remove ${find(w.applications, g.applicationId).name} ${g.level} access`,
                  `revoke:${g.id}`,
                  g.applicationId,
                ] as [string, string, string],
            ),
          ["Review remaining groups and elevated roles", "review_access"],
          [
            "Preserve email and transfer data — administrator review",
            "preserve",
          ],
          ["Confirm equipment return", "equipment_return"],
          ["Confirm handover", "handover"],
          ...(w.templates.find((t) => t.id === e.templateId)?.licenseId
            ? [
                ["Reclaim preserved Microsoft license", "unlicense"] as [
                  string,
                  string,
                ],
              ]
            : []),
          ["Complete offboarding", "terminate"],
        ]),
      };
      w.jobs.push(job);
      audit(w, a, "Offboarding scheduled", e.id, requestId, "active", {
        scheduledAt: at,
        jobId: job.id,
      });
      notify(w, "admins", "Offboarding scheduled", `${fullName(e)} · ${at}`);
      return job.id;
    }
    case "employee-update": {
      requireRole(a, [...admins, "HR_ADMIN"]);
      const e = find(w.employees, input.id);
      const previous = {
        firstName: e.firstName,
        lastName: e.lastName,
        personalEmail: e.personalEmail,
        startDate: e.startDate,
        employmentType: e.employmentType,
        title: e.title,
        department: e.department,
        managerId: e.managerId,
        location: e.location,
      };
      const managerId = str(input.managerId ?? "", "manager", false);
      if (managerId) {
        const manager = find(w.employees, managerId);
        if (manager.id === e.id || manager.status !== "active")
          throw new DomainError(
            "Choose a different active employee as manager.",
          );
      }
      if (input.firstName !== undefined)
        e.firstName = str(input.firstName, "first name");
      if (input.lastName !== undefined)
        e.lastName = str(input.lastName, "last name");
      if (input.personalEmail !== undefined)
        e.personalEmail = input.personalEmail ? email(input.personalEmail) : "";
      if (input.startDate !== undefined) {
        const date = str(input.startDate, "start date");
        if (!isCalendarDate(date))
          throw new DomainError("Choose a valid start date.");
        e.startDate = date;
      }
      if (input.employmentType !== undefined) {
        if (
          ![
            "Full-time",
            "Part-time",
            "Contractor",
            "Intern",
            "Temporary",
          ].includes(String(input.employmentType))
        )
          throw new DomainError("Choose an employment type.");
        e.employmentType = String(input.employmentType);
      }
      e.title = str(input.title ?? "", "job title", false);
      e.department = str(input.department, "department");
      e.managerId = managerId;
      e.location = str(input.location ?? "", "location", false);
      if (input.usageLocation)
        e.usageLocation = countryCode(input.usageLocation);
      audit(w, a, "Employee details updated", e.id, requestId, previous, {
        firstName: e.firstName,
        lastName: e.lastName,
        personalEmail: e.personalEmail,
        startDate: e.startDate,
        employmentType: e.employmentType,
        title: e.title,
        department: e.department,
        managerId: e.managerId,
        location: e.location,
      });
      return e.id;
    }
    case "template": {
      requireRole(a, [...admins, "HR_ADMIN"]);
      const applications = arr(input.applications);
      applications.forEach((id) => find(w.applications, id));
      const groups = arr(input.groups ?? []);
      if (
        !w.demo &&
        groups.some(
          (g) =>
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              g,
            ),
        )
      )
        throw new DomainError("Microsoft groups must use their object IDs.");
      const next: Template = {
        id: input.id ? find(w.templates, input.id).id : uid(),
        name: str(input.name, "template name"),
        description: str(input.description ?? "", "description", false, 500),
        applications,
        groups,
        licenseId: str(input.licenseId ?? "", "license ID", false),
        active: input.active !== false,
      };
      const index = w.templates.findIndex((t) => t.id === next.id);
      const previous = index >= 0 ? w.templates[index] : undefined;
      if (index >= 0) w.templates[index] = next;
      else w.templates.push(next);
      audit(
        w,
        a,
        previous ? "Role template updated" : "Role template created",
        next.name,
        requestId,
        previous,
        next,
      );
      return next.id;
    }
    case "request": {
      requireRole(a, ["EMPLOYEE", "MANAGER", "APPROVER", ...admins]);
      const e = find(
        w.employees,
        admins.includes(a.role)
          ? input.employeeId || a.employeeId
          : a.employeeId,
      );
      if (e.status !== "active")
        throw new DomainError("Only active employees may request access.");
      const app = find(w.applications, input.applicationId);
      if (app.mode === "coming_soon")
        throw new DomainError("This application is not available yet.");
      if (
        typeof input.durationMinutes !== "number" &&
        (typeof input.durationMinutes !== "string" ||
          !/^\d+$/.test(input.durationMinutes))
      )
        throw new DomainError("Choose a valid access duration.");
      const duration = Number(input.durationMinutes);
      if (!Number.isInteger(duration) || duration < 0 || duration > 43200)
        throw new DomainError(
          "Duration must be between 1 minute and 30 days, or permanent.",
        );
      const level = str(input.level, "permission");
      if (!["Read", "Write", "Standard", "Admin"].includes(level))
        throw new DomainError("Unsupported permission level.");
      if (app.mode === "microsoft" && level !== "Standard")
        throw new DomainError(
          "Automated Microsoft access supports the configured security group at Standard level. Elevated directory roles require manual administration.",
        );
      if (
        w.requests.some(
          (r) =>
            r.employeeId === e.id &&
            r.applicationId === app.id &&
            r.level === level &&
            ["pending", "more_info", "approved"].includes(r.status),
        )
      )
        throw new DomainError(
          "You already have an open request for this access.",
          409,
        );
      if (
        w.grants.some(
          (g) =>
            g.employeeId === e.id &&
            g.applicationId === app.id &&
            g.level === level &&
            ["active", "manual_required", "revoking"].includes(g.status),
        )
      )
        throw new DomainError(
          "You already have this permission or a change to it is in progress.",
        );
      const stages = w.approvalRule.length
        ? [...w.approvalRule]
        : ["admin" as const];
      if (stages.includes("manager") && !e.managerId)
        throw new DomainError(
          "Your organization must assign a manager before you can submit this request.",
        );
      if (stages.includes("owner") && !app.ownerId)
        throw new DomainError("An application owner must be assigned first.");
      const r = {
        id: uid(),
        employeeId: e.id,
        applicationId: app.id,
        level,
        reason: str(input.reason, "reason", true, 2000),
        durationMinutes: duration,
        status: "pending" as const,
        stages,
        approvals: [],
        createdAt: now(),
      };
      w.requests.push(r);
      audit(w, a, "Access requested", e.id, requestId, undefined, {
        application: app.name,
        level,
        duration,
      });
      notify(
        w,
        stages[0] === "manager"
          ? e.managerId
          : stages[0] === "owner"
            ? app.ownerId!
            : "admins",
        `${fullName(e)} requested ${app.name} ${level}`,
        r.reason,
      );
      return r.id;
    }
    case "decision": {
      const r = find(w.requests, input.id);
      if (!mayApprove(w, a, r))
        throw new DomainError(
          "You are not the current approver, or this request was already decided.",
          403,
        );
      const decision = str(input.decision, "decision");
      if (!["approve", "reject", "more_info"].includes(decision))
        throw new DomainError("Invalid decision.");
      const note = str(input.note ?? "", "note", decision !== "approve", 2000);
      const stage =
        r.stages[r.approvals.filter((v) => v.decision === "approve").length];
      r.approvals.push({
        actorId: a.id,
        name: a.name,
        stage,
        decision,
        at: now(),
        note,
      });
      if (decision === "reject") r.status = "rejected";
      else if (decision === "more_info") r.status = "more_info";
      else if (
        r.approvals.filter((v) => v.decision === "approve").length ===
        r.stages.length
      ) {
        const e = find(w.employees, r.employeeId);
        if (e.status !== "active")
          throw new DomainError("Employee is no longer active.");
        r.status = "approved";
        w.jobs.push({
          id: uid(),
          employeeId: r.employeeId,
          kind: "grant",
          status: "pending",
          requestId: r.id,
          createdAt: now(),
          scheduledAt: now(),
          steps: steps([
            [
              `Grant ${find(w.applications, r.applicationId).name} ${r.level}`,
              "grant",
              r.applicationId,
            ],
          ]),
        });
      } else {
        r.status = "pending";
        const next =
          r.stages[r.approvals.filter((v) => v.decision === "approve").length];
        notify(
          w,
          next === "manager"
            ? find(w.employees, r.employeeId).managerId
            : next === "owner"
              ? find(w.applications, r.applicationId).ownerId!
              : "admins",
          "Access request needs your approval",
          r.reason,
        );
      }
      audit(
        w,
        a,
        `Access request ${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "needs information"}`,
        r.employeeId,
        requestId,
        undefined,
        { requestId: r.id, stage, note },
      );
      notify(
        w,
        r.employeeId,
        `Access request: ${r.status.replace("_", " ")}`,
        note || "Your request has been reviewed.",
      );
      return r.id;
    }
    case "reply": {
      const r = find(w.requests, input.id);
      if (r.employeeId !== a.employeeId || r.status !== "more_info")
        throw new DomainError("This request is not awaiting your reply.", 403);
      r.reason += `\n\nAdditional information: ${str(input.note, "reply", true, 2000)}`;
      r.status = "pending";
      audit(w, a, "Access request clarified", r.employeeId, requestId);
      return r.id;
    }
    case "retry": {
      requireRole(a, [...admins, "HR_ADMIN"]);
      const job = find(w.jobs, input.id);
      if (job.status !== "failed")
        throw new DomainError("Only failed jobs can be retried.");
      if (
        job.kind === "grant" &&
        find(w.employees, job.employeeId).status !== "active"
      )
        throw new DomainError(
          "Access cannot be granted to an inactive employee.",
        );
      job.steps
        .filter((s) => s.status === "failed")
        .forEach((s) => {
          s.status = "pending";
          s.attempts = 0;
          delete s.error;
          delete s.lease;
          delete s.leaseUntil;
          delete s.nextAttemptAt;
        });
      job.status = "pending";
      audit(w, a, "Workflow retry requested", job.employeeId, requestId);
      return job.id;
    }
    case "manual-complete": {
      requireRole(a, admins);
      const job = find(w.jobs, input.id);
      const step = find(job.steps, input.stepId);
      if (step.status !== "manual_required")
        throw new DomainError("This step is not awaiting a manual action.");
      if (
        job.steps
          .slice(0, job.steps.indexOf(step))
          .some((s) => !["success", "skipped"].includes(s.status))
      )
        throw new DomainError(
          "Complete the earlier workflow steps before verifying this step.",
          409,
        );
      const tracked = w.grants.find((g) => g.id === step.grantId);
      if (
        tracked?.expiresAt &&
        Date.parse(tracked.expiresAt) <= Date.now() &&
        job.kind === "grant"
      )
        throw new DomainError(
          "This temporary approval has expired. Complete the removal workflow instead.",
        );
      const note = str(input.note, "completion evidence", true, 2000);
      const proof = evidence(a, {
        ...input,
        provider: input.provider || "Manual provider",
        target: input.target || step.name,
        method: input.method || "Administrator attestation",
      });
      step.evidence = proof;
      step.status = "success";
      step.error = `Manually verified: ${note}`;
      const grant = w.grants.find((g) => g.id === step.grantId);
      if (grant) grant.evidence = proof;
      if (grant)
        grant.status =
          job.kind === "revoke" || job.kind === "offboard"
            ? "revoked"
            : "active";
      job.status = "pending";
      audit(
        w,
        a,
        "Manual workflow step verified",
        job.employeeId,
        requestId,
        undefined,
        { step: step.name, evidence: proof },
      );
      return job.id;
    }
    case "notification-retry": {
      requireRole(a, admins);
      const n = find(w.notifications, input.id);
      if (!["failed", "unconfigured"].includes(n.emailStatus))
        throw new DomainError(
          "Only failed or unconfigured notifications can be retried.",
        );
      n.emailStatus = "pending";
      n.attempts = 0;
      delete n.nextAttemptAt;
      audit(w, a, "Notification delivery retried", n.id, requestId);
      return n.id;
    }
    case "settings": {
      requireRole(a, admins);
      const previous = {
        name: w.name,
        domain: w.domain,
        approvalRule: w.approvalRule,
      };
      w.name = str(input.name, "organization name");
      const domain = str(input.domain ?? "", "domain", false);
      if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))
        throw new DomainError("Invalid company domain.");
      w.domain = domain;
      const rules = arr(input.approvalRule);
      if (
        !rules.length ||
        rules.some((r) => !["manager", "owner", "admin"].includes(r))
      )
        throw new DomainError("Choose at least one approval stage.");
      w.approvalRule = rules as Workspace["approvalRule"];
      audit(
        w,
        a,
        "Organization settings updated",
        w.name,
        requestId,
        previous,
        { name: w.name, domain: w.domain, approvalRule: w.approvalRule },
      );
      return w.id;
    }
    case "application": {
      requireRole(a, admins);
      const app = find(w.applications, input.id);
      const previous = structuredClone(app);
      const owner = str(input.ownerId ?? "", "owner", false);
      if (owner) find(w.employees, owner);
      app.ownerId = owner;
      const groupId = str(input.groupId ?? "", "group ID", false);
      if (
        groupId &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          groupId,
        )
      )
        throw new DomainError("Enter a Microsoft group object ID.");
      app.groupId = groupId;
      audit(
        w,
        a,
        "Application configuration updated",
        app.name,
        requestId,
        previous,
        app,
      );
      return app.id;
    }
    case "notifications-read": {
      w.notifications.forEach((n) => {
        if (
          n.recipientId === a.id ||
          n.recipientId === a.employeeId ||
          (n.recipientId === "admins" && admins.includes(a.role))
        )
          n.read = true;
      });
      return true;
    }
    case "support-note": {
      requireRole(a, ["PLATFORM_OWNER", "PLATFORM_SUPPORT"]);
      const note = {
        id: uid(),
        author: a.name,
        body: str(input.body, "support note", true, 4000),
        at: now(),
      };
      w.supportNotes.push(note);
      audit(w, a, "Support note added", w.name, requestId);
      return note.id;
    }
    case "import": {
      requireRole(a, admins);
      if (!Array.isArray(input.employees) || input.employees.length > 200)
        throw new DomainError("Import a maximum of 200 records.");
      let count = 0;
      for (const raw of input.employees) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new DomainError(
            "Each imported employee must be a JSON object.",
          );
        const r = raw as Input;
        const address = email(r.email);
        if (w.employees.some((e) => e.email === address)) continue;
        w.employees.push({
          id: uid(),
          firstName: str(r.firstName, "first name"),
          lastName: str(r.lastName, "last name"),
          email: address,
          personalEmail: "",
          title: str(r.title ?? "", "title", false),
          department: str(r.department ?? "Unassigned", "department"),
          managerId: "",
          startDate: now().slice(0, 10),
          location: "",
          employmentType: "Full-time",
          status: "active",
          createdAt: now(),
        });
        count++;
      }
      audit(w, a, "Employee inventory imported", w.name, requestId, undefined, {
        count,
        providerMatching:
          "Run Microsoft sync to match identities by company email",
      });
      return count;
    }
    default:
      throw new DomainError("Unknown action.", 404);
  }
}
export function newGrant(
  w: Workspace,
  employeeId: string,
  applicationId: string,
  level: string,
  source: string,
  durationMinutes = 0,
): Grant {
  // Distinct privilege levels remain independent; permanent access is never overwritten by a temporary request.
  const existing = w.grants.find(
    (g) =>
      g.employeeId === employeeId &&
      g.applicationId === applicationId &&
      g.level === level &&
      ["active", "manual_required"].includes(g.status),
  );
  if (existing) return existing;
  const grant: Grant = {
    id: uid(),
    employeeId,
    applicationId,
    level,
    source,
    status: "active",
    ...(durationMinutes
      ? {
          expiresAt: new Date(
            Date.now() + durationMinutes * 60_000,
          ).toISOString(),
        }
      : {}),
  };
  w.grants.push(grant);
  return grant;
}
