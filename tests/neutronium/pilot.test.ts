import test from "node:test";
import assert from "node:assert/strict";
import { seed, Actor, project, uid } from "../../src/lib/neutronium/model";
import { command } from "../../src/lib/neutronium/service";
import { remindOperations } from "../../src/lib/neutronium/operations";
import { fileTicket, verifyFileTicket } from "../../src/lib/neutronium/files";
import { validateTotp, recoveryDigest } from "../../src/lib/neutronium/mfa";
import { TOTP } from "otpauth";
const actor = (
  w: ReturnType<typeof seed>,
  role: Actor["role"] = "ORG_OWNER",
  i?: number,
): Actor => ({
  id: role === "EMPLOYEE" ? "employee" : "owner",
  name: "Operator",
  role,
  orgId: w.id,
  demo: true,
  employeeId: i === undefined ? undefined : w.employees[i].id,
});
const proof = {
  provider: "Provider console",
  target: "employee@example.test",
  method: "Read provider configuration",
  note: "Verified requested delivery",
};
test("required checklist blocks completion; private notes are absent from employee projection", () => {
  const w = seed(),
    a = actor(w),
    e = actor(w, "EMPLOYEE", 0);
  const id = command(w, e, "help-create", {
    kind: "equipment",
    subject: "Monitor",
    body: "Need monitor",
    dueAt: "2020-01-01",
  }) as string;
  command(w, a, "operation-note", { id, body: "Private budget note" });
  assert(!JSON.stringify(project(w, e)).includes("Private budget note"));
  assert.throws(
    () =>
      command(w, a, "operation-update", {
        id,
        fulfillment: "completed",
        ...proof,
      }),
    /required checklist/,
  );
  const task = w.helpRequests![0].tasks![0];
  command(w, a, "operation-task", {
    id,
    taskId: task.id,
    completed: true,
    ...proof,
  });
  command(w, a, "operation-update", { id, fulfillment: "completed", ...proof });
  assert.equal(w.helpRequests![0].evidence?.confirmedBy, a.id);
  assert.equal(w.helpRequests![0].evidence?.kind, "manual");
  assert.throws(
    () =>
      command(w, actor(w, "EMPLOYEE", 2), "operation-note", {
        id,
        body: "Intrusion",
      }),
    /not found/,
  );
});
test("contractor requests use staged approvals and exact expiry; no grant job is created early", () => {
  const w = seed(),
    e = actor(w, "EMPLOYEE", 0);
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  const id = command(w, e, "help-create", {
    kind: "contractor",
    subject: "Temporary Notion",
    body: "Client project",
    applicationId: w.applications[3].id,
    expiresAt,
  });
  const r = w.helpRequests!.find((r) => r.id === id)!;
  assert(r.accessRequestId);
  assert.equal(
    w.requests.find((x) => x.id === r.accessRequestId)?.expiresAt,
    expiresAt,
  );
  assert.equal(w.jobs.length, 0);
  assert.throws(
    () =>
      command(w, actor(w), "operation-update", {
        id,
        fulfillment: "completed",
        ...proof,
      }),
    /access must be fulfilled/,
  );
});
test("checklist templates are snapshotted and reminders deduplicated", () => {
  const w = seed(),
    a = actor(w),
    e = actor(w, "EMPLOYEE", 0);
  const template = command(w, a, "checklist-template", {
    name: "Letter",
    kind: "document",
    tasks: [{ title: "Prepare letter", required: true }],
  });
  command(w, e, "help-create", {
    kind: "document",
    subject: "Letter",
    body: "Please",
    dueAt: "2020-01-01",
  });
  command(w, a, "checklist-template", {
    id: template,
    name: "Changed",
    kind: "document",
    tasks: [{ title: "Different", required: true }],
  });
  assert.equal(w.helpRequests![0].tasks![0].title, "Prepare letter");
  remindOperations(w);
  const count = w.notifications.length;
  remindOperations(w);
  assert.equal(w.notifications.length, count);
});
test("employee cannot initiate offboarding; QA rejects account assigned to somebody else", () => {
  const w = seed(),
    a = actor(w),
    e = actor(w, "EMPLOYEE", 0);
  assert.throws(
    () =>
      command(w, e, "help-create", {
        kind: "offboarding",
        subject: "Leave",
        body: "Leave",
      }),
    /administrator/,
  );
  const envId = command(w, a, "test-environment-save", {
    name: "Staging",
    kind: "staging",
    url: "https://staging.example.com",
  });
  const accountId = command(w, a, "tester-account-save", {
    environmentId: envId,
    label: "Tester",
    username: "alex",
    employeeId: w.employees[2].id,
  });
  const id = command(w, a, "help-create", {
    kind: "qa",
    employeeId: w.employees[0].id,
    environmentId: envId,
    subject: "Test",
    body: "Test staging",
  });
  assert.throws(
    () => command(w, a, "operation-update", { id, testerAccountId: accountId }),
    /assigned to this employee/,
  );
});
test("signed downloads bind company, user, session and expiry", () => {
  process.env.NEUTRONIUM_FILE_SIGNING_KEY = "a".repeat(32);
  const w = seed(),
    a = actor(w);
  const ticket = fileTicket(a, uid(), uid(), "session");
  assert(verifyFileTicket(ticket, a, "session"));
  assert.throws(() =>
    verifyFileTicket(ticket, { ...a, orgId: uid() }, "session"),
  );
  assert.throws(() => verifyFileTicket(ticket, a, "different"));
  assert.throws(() =>
    verifyFileTicket(fileTicket(a, uid(), uid(), "session", 0), a, "session"),
  );
});
test("TOTP rejects replay, malformed and expired codes; recovery digests do not expose codes", () => {
  const totp = new TOTP({ secret: "JBSWY3DPEHPK3PXP", period: 30 });
  const timestamp = 1760000000000;
  const code = totp.generate({ timestamp });
  const counter = validateTotp("JBSWY3DPEHPK3PXP", code, -1, timestamp);
  assert.equal(typeof counter, "number");
  assert.equal(
    validateTotp("JBSWY3DPEHPK3PXP", code, counter!, timestamp),
    null,
  );
  assert.equal(validateTotp("JBSWY3DPEHPK3PXP", "bad", -1, timestamp), null);
  assert.equal(
    validateTotp("JBSWY3DPEHPK3PXP", code, -1, timestamp + 180000),
    null,
  );
  assert.notEqual(recoveryDigest("recovery secret"), "recovery secret");
});
test("incomplete Microsoft collection never becomes a complete snapshot", async () => {
  const { graphPages } = await import(
    "../../src/lib/neutronium/microsoft-readiness"
  );
  let calls = 0;
  const provider = {
    graph: async () => {
      calls++;
      if (calls === 1)
        return {
          value: [{ id: "a" }],
          "@odata.nextLink":
            "https://graph.microsoft.com/v1.0/users?$skiptoken=next",
        };
      throw new Error("Provider unavailable");
    },
  };
  await assert.rejects(
    graphPages(provider as any, "/users?$top=1", "inventory"),
    /Provider unavailable/,
  );
  assert.equal(calls, 2);
});
test("offboarding license reclamation is blocked without preservation evidence", async () => {
  const { executeStep } = await import("../../src/lib/neutronium/providers");
  const w = seed();
  const a = actor(w);
  w.templates[0].licenseId = "license";
  command(w, a, "offboard", {
    employeeId: w.employees[0].id,
    confirmation: w.employees[0].email,
  });
  const j = w.jobs[0],
    s = j.steps.find((s) => s.operation === "unlicense")!;
  await assert.rejects(executeStep(w, j, s), /preservation evidence/);
});
