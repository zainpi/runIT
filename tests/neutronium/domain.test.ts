import test from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  Actor,
  uid,
  project,
  mayApprove,
  DomainError,
} from "../../src/lib/neutronium/model";
import { command, newGrant } from "../../src/lib/neutronium/service";
import { claim, scheduleExpirations } from "../../src/lib/neutronium/worker";
import {
  encrypt,
  decrypt,
  DevelopmentProvider,
  executeStep,
} from "../../src/lib/neutronium/providers";
const setup = () => {
  const w = seed();
  const admin: Actor = {
    id: "owner",
    name: "Owner",
    role: "ORG_OWNER",
    orgId: w.id,
    demo: true,
  };
  const sarah: Actor = {
    ...admin,
    id: "sarah",
    role: "EMPLOYEE",
    employeeId: w.employees[0].id,
  };
  const manager: Actor = {
    ...admin,
    id: "michael",
    role: "MANAGER",
    employeeId: w.employees[1].id,
  };
  return { w, admin, sarah, manager };
};
const employeeInput = (w: ReturnType<typeof seed>) => ({
  firstName: "Sam",
  lastName: "Lee",
  email: "sam@acme.example",
  department: "Engineering",
  title: "Developer",
  startDate: "2026-09-08",
  managerId: w.employees[1].id,
  templateId: w.templates[0].id,
});
test("onboarding persists an asynchronous, individually tracked workflow", () => {
  const { w, admin } = setup();
  const id = command(w, admin, "onboard", employeeInput(w));
  const job = w.jobs.find((j) => j.id === id)!;
  assert.equal(w.employees.length, 4);
  assert.equal(job.status, "pending");
  assert.equal(job.steps.length, 4);
  assert(job.steps.every((s) => s.status === "pending"));
  assert.equal(w.audit.at(-1)?.action, "Employee onboarding started");
});
test("employees and operators cannot create or offboard employees", () => {
  const { w, sarah, admin } = setup();
  for (const actor of [sarah, { ...admin, role: "PLATFORM_OWNER" as const }])
    assert.throws(
      () => command(w, actor, "onboard", employeeInput(w)),
      DomainError,
    );
});
test("cross-tenant writes and reads are rejected", () => {
  const { w, admin } = setup();
  const other = { ...admin, orgId: uid() };
  assert.throws(
    () => command(w, other, "onboard", employeeInput(w)),
    /Organization mismatch/,
  );
  assert.throws(() => project(w, other), /Workspace not found/);
});
test("foreign employee and template IDs cannot be used", () => {
  const { w, admin } = setup();
  assert.throws(
    () =>
      command(w, admin, "onboard", { ...employeeInput(w), templateId: uid() }),
    /not found/,
  );
  assert.throws(
    () => command(w, admin, "offboard", { employeeId: uid() }),
    /not found/,
  );
});
test("duplicate emails are rejected before creating a second job", () => {
  const { w, admin } = setup();
  command(w, admin, "onboard", employeeInput(w));
  assert.throws(
    () => command(w, admin, "onboard", employeeInput(w)),
    /already has/,
  );
  assert.equal(w.jobs.length, 1);
});
test("only assigned manager may approve and cannot approve their own request", () => {
  const { w, admin, sarah, manager } = setup();
  const r = w.requests[0];
  assert.equal(mayApprove(w, sarah, r), false);
  assert.equal(mayApprove(w, admin, r), false);
  assert.equal(mayApprove(w, manager, r), true);
  assert.throws(
    () => command(w, admin, "decision", { id: r.id, decision: "approve" }),
    /not the current approver/,
  );
  command(w, manager, "decision", { id: r.id, decision: "approve" });
  assert.equal(r.status, "approved");
  assert.equal(w.jobs[0].kind, "grant");
  assert.throws(() =>
    command(w, manager, "decision", { id: r.id, decision: "approve" }),
  );
});
test("multi-stage approval never provisions before all stages approve", () => {
  const { w, admin, manager } = setup();
  const r = w.requests[0];
  r.stages = ["manager", "admin"];
  command(w, manager, "decision", { id: r.id, decision: "approve" });
  assert.equal(r.status, "pending");
  assert.equal(w.jobs.length, 0);
  command(w, admin, "decision", { id: r.id, decision: "approve" });
  assert.equal(r.status, "approved");
  assert.equal(w.jobs.length, 1);
});
test("more information round trip retains an audit history", () => {
  const { w, sarah, manager } = setup();
  const r = w.requests[0];
  command(w, manager, "decision", {
    id: r.id,
    decision: "more_info",
    note: "Which incident?",
  });
  assert.equal(r.status, "more_info");
  command(w, sarah, "reply", { id: r.id, note: "Incident 123" });
  assert.equal(r.status, "pending");
  assert(r.reason.includes("Incident 123"));
  command(w, manager, "decision", { id: r.id, decision: "approve" });
  assert.equal(r.approvals.length, 2);
});
test("employee projection filters private records and internal support notes in production", () => {
  const { w, sarah } = setup();
  w.demo = false;
  w.supportNotes.push({
    id: uid(),
    author: "Operator",
    at: new Date().toISOString(),
    body: "Internal",
  });
  w.employees[1].personalEmail = "private@example.com";
  const result = project(w, { ...sarah, demo: false });
  assert.equal(result.employees.length, 1);
  assert.equal(result.supportNotes.length, 0);
  assert.equal(result.templates.length, 0);
  assert.equal(result.integrations.length, 0);
  assert(result.grants.every((g) => g.employeeId === sarah.employeeId));
  assert(!JSON.stringify(result).includes("private@example.com"));
});
test("claim leases prevent concurrent workers from executing the same step", () => {
  const { w, admin } = setup();
  command(w, admin, "onboard", employeeInput(w));
  const first = claim(w);
  assert(first?.step.lease);
  assert.equal(claim(w), null);
  w.jobs[0].steps[0].leaseUntil = new Date(Date.now() - 1000).toISOString();
  const recovered = claim(w);
  assert(recovered);
  assert.notEqual(first.step.lease, recovered.step.lease);
  assert.equal(recovered.step.attempts, 2);
});
test("scheduled offboarding cannot be claimed before its due date", () => {
  const { w, admin } = setup();
  const e = w.employees[0];
  command(w, admin, "offboard", {
    employeeId: e.id,
    confirmation: e.email,
    scheduledAt: new Date(Date.now() + 86400_000).toISOString(),
  });
  assert.equal(claim(w), null);
  assert.equal(w.employees[0].status, "offboarding");
});
test("offboarding requires exact employee email and cannot be duplicated", () => {
  const { w, admin } = setup();
  const e = w.employees[0];
  assert.throws(
    () =>
      command(w, admin, "offboard", { employeeId: e.id, confirmation: "yes" }),
    /Type/,
  );
  command(w, admin, "offboard", { employeeId: e.id, confirmation: e.email });
  assert.throws(
    () =>
      command(w, admin, "offboard", {
        employeeId: e.id,
        confirmation: e.email,
      }),
    /not available/,
  );
});
test("expiration queues one durable revocation and leaves permanent access intact", () => {
  const { w } = setup();
  const e = w.employees[0];
  const app = w.applications[1];
  const permanent = w.grants.find(
    (g) => g.employeeId === e.id && g.applicationId === app.id,
  )!;
  const temp = newGrant(w, e.id, app.id, "Admin", "test", 1);
  temp.expiresAt = new Date(Date.now() - 100).toISOString();
  scheduleExpirations(w);
  scheduleExpirations(w);
  assert.equal(w.jobs.length, 1);
  assert.equal(temp.status, "revoking");
  assert.equal(permanent.status, "active");
  assert.equal(w.jobs[0].steps[0].operation, `revoke:${temp.id}`);
});
test("same-level grant never shortens existing permanent access", () => {
  const { w } = setup();
  const e = w.employees[0];
  const app = w.applications[0];
  const original = w.grants[0];
  const granted = newGrant(
    w,
    e.id,
    app.id,
    "Standard",
    "temporary-request",
    60,
  );
  assert.equal(granted.id, original.id);
  assert.equal(granted.expiresAt, undefined);
});
test("unsupported application steps are manual, never simulated success", async () => {
  const { w, admin } = setup();
  w.templates[0].applications = [w.applications[2].id];
  command(w, admin, "onboard", employeeInput(w));
  const job = w.jobs[0];
  const result = await executeStep(w, job, job.steps[1]);
  assert.equal(result.status, "manual_required");
});
test("development adapter is idempotent", async () => {
  const { w } = setup();
  const provider = new DevelopmentProvider();
  assert.deepEqual(
    await provider.createIdentity(w.employees[0]),
    await provider.createIdentity(w.employees[0]),
  );
});
test("manual verification requires admin role and evidence", () => {
  const { w, admin } = setup();
  command(w, admin, "onboard", employeeInput(w));
  const j = w.jobs[0],
    s = j.steps[0];
  s.status = "manual_required";
  j.status = "manual_required";
  assert.throws(
    () =>
      command(w, { ...admin, role: "HR_ADMIN" }, "manual-complete", {
        id: j.id,
        stepId: s.id,
        note: "Done",
      }),
    /permission/,
  );
  assert.throws(
    () =>
      command(w, admin, "manual-complete", {
        id: j.id,
        stepId: s.id,
        note: "",
      }),
    /evidence/,
  );
  command(w, admin, "manual-complete", {
    id: j.id,
    stepId: s.id,
    note: "Verified in provider ticket 123",
  });
  assert.equal(s.status, "success");
});
test("encryption authenticates tenant binding and supports key rotation", () => {
  process.env.NEUTRONIUM_ENCRYPTION_KEYS = JSON.stringify({
    v1: Buffer.alloc(32, 1).toString("base64"),
    v2: Buffer.alloc(32, 2).toString("base64"),
  });
  process.env.NEUTRONIUM_ACTIVE_KEY_VERSION = "v1";
  const old = encrypt({ secret: "sensitive" }, "tenant-a");
  assert.equal(
    decrypt(old.ciphertext, old.key_version, "tenant-a").secret,
    "sensitive",
  );
  assert.throws(() => decrypt(old.ciphertext, old.key_version, "tenant-b"));
  process.env.NEUTRONIUM_ACTIVE_KEY_VERSION = "v2";
  const next = encrypt({ secret: "rotated" }, "tenant-a");
  assert.equal(next.key_version, "v2");
  assert.equal(decrypt(old.ciphertext, "v1", "tenant-a").secret, "sensitive");
});

test("offboarding cancels queued grants and rejects a live grant lease", () => {
  const { w, admin, manager } = setup();
  command(w, manager, "decision", {
    id: w.requests[0].id,
    decision: "approve",
  });
  const e = w.employees[0];
  const leased = claim(w)!;
  assert.throws(
    () =>
      command(w, admin, "offboard", {
        employeeId: e.id,
        confirmation: e.email,
      }),
    /currently running/,
  );
  w.jobs[0].steps[0].status = "pending";
  command(w, admin, "offboard", { employeeId: e.id, confirmation: e.email });
  assert.equal(w.jobs.find((j) => j.id === leased.job.id)?.status, "failed");
  assert.throws(
    () => command(w, admin, "retry", { id: leased.job.id }),
    /inactive employee/,
  );
});

test("employee manager changes require a valid different active employee", () => {
  const { w, admin } = setup();
  const e = w.employees[0];
  assert.throws(
    () =>
      command(w, admin, "employee-update", {
        id: e.id,
        managerId: e.id,
        department: "Engineering",
      }),
    /different active/,
  );
  command(w, admin, "employee-update", {
    id: e.id,
    managerId: w.employees[1].id,
    department: "Platform",
    title: "Engineer",
    location: "Toronto",
  });
  assert.equal(e.department, "Platform");
  assert.equal(w.audit.at(-1)?.action, "Employee details updated");
});

test("operator projection redacts private HR fields and scopes permission inventory by role", () => {
  const { w, admin } = setup();
  w.demo = false;
  w.employees[0].personalEmail = "private@example.com";
  w.employees[0].location = "Private address";
  const support = project(w, {
    ...admin,
    role: "PLATFORM_SUPPORT",
    demo: false,
  });
  assert.equal(support.employees.length, 3);
  assert.equal(support.employees[0].personalEmail, "");
  assert.equal(support.employees[0].location, "");
  assert.equal(support.grants.length, 0);
  const security = project(w, {
    ...admin,
    role: "PLATFORM_SECURITY",
    demo: false,
  });
  assert.equal(security.grants.length, w.grants.length);
  assert(
    security.audit.every(
      (e) => e.previous === undefined && e.next === undefined,
    ),
  );
});

test("help conversations isolate employees and restrict attachments to admins", () => {
  const w = seed();
  const admin: Actor = {
    id: "admin",
    name: "Admin",
    role: "ORG_OWNER",
    orgId: w.id,
    demo: true,
  };
  const employee: Actor = {
    ...admin,
    id: "employee",
    role: "EMPLOYEE",
    employeeId: w.employees[0].id,
  };
  const other: Actor = { ...employee, employeeId: w.employees[1].id };
  const id = command(w, employee, "help-create", {
    subject: "Monitor",
    body: "Please send a monitor.",
  });
  assert.equal(project(w, other).helpRequests?.length, 0);
  assert.throws(
    () => command(w, other, "help-reply", { id, body: "Stolen" }),
    DomainError,
  );
  assert.throws(
    () =>
      command(w, employee, "help-reply", {
        id,
        body: "File",
        attachment: { name: "a.txt", data: "YQ==" },
      }),
    DomainError,
  );
  command(w, admin, "help-reply", {
    id,
    body: "Here is the order",
    status: "resolved",
    attachment: { name: "order.txt", data: "YQ==" },
  });
  assert.equal(
    project(w, employee).helpRequests?.[0].messages[0].attachment?.data,
    "YQ==",
  );
  assert.equal(w.helpRequests?.[0].status, "resolved");
  assert.throws(
    () =>
      command(w, admin, "help-reply", {
        id,
        body: "Too large",
        attachment: { name: "a", data: Buffer.alloc(50001).toString("base64") },
      }),
    DomainError,
  );
  command(w, employee, "help-reply", { id, body: "One more question" });
  assert.equal(w.helpRequests?.[0].status, "open");
  assert.throws(
    () => command({ ...w, id: "other" }, admin, "help-create", {}),
    DomainError,
  );
});
test("test accounts are isolated to development and security data to admins", () => {
  const w = seed();
  const a: Actor = {
    id: "admin",
    name: "Admin",
    role: "ORG_OWNER",
    orgId: w.id,
    demo: true,
  };
  command(w, a, "test-employee", {});
  assert.equal(w.employees.at(-1)?.employmentType, "Test");
  assert.throws(
    () => command({ ...w, demo: false }, a, "test-employee", {}),
    DomainError,
  );
  w.securityAlerts = [
    {
      id: "risk",
      email: "secret@example.com",
      level: "high",
      state: "atRisk",
      detail: "risk",
      at: new Date().toISOString(),
    },
  ];
  w.externalItems = {
    jira: [
      { id: "1", title: "Private", status: "Open", url: "https://example.com" },
    ],
  };
  assert.deepEqual(
    project(w, { ...a, role: "EMPLOYEE", employeeId: w.employees[0].id })
      .securityAlerts,
    [],
  );
  assert.deepEqual(project(w, { ...a, role: "HR_ADMIN" }).externalItems, {});
});
