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
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new DomainError(`Enter a valid ${label}.`);
  return v.trim();
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
    case "onboard": {
      requireRole(a, [...admins, "HR_ADMIN"]);
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
      schedule(startDate);
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
      e.title = str(input.title ?? "", "job title", false);
      e.department = str(input.department, "department");
      e.managerId = managerId;
      e.location = str(input.location ?? "", "location", false);
      audit(w, a, "Employee details updated", e.id, requestId, previous, {
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
      if (!w.demo && groups.some((g) => !/^[0-9a-f-]{36}$/i.test(g)))
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
      const e = find(w.employees, a.employeeId);
      if (e.status !== "active")
        throw new DomainError("Only active employees may request access.");
      const app = find(w.applications, input.applicationId);
      if (app.mode === "coming_soon")
        throw new DomainError("This application is not available yet.");
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
      step.status = "success";
      step.error = `Manually verified: ${note}`;
      const grant = w.grants.find((g) => g.id === step.grantId);
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
        { step: step.name, evidence: note },
      );
      return job.id;
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
      if (groupId && !/^[0-9a-f-]{36}$/i.test(groupId))
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
