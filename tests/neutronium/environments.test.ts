import test from "node:test";
import assert from "node:assert/strict";
import { Actor, seed, project } from "../../src/lib/neutronium/model";
import { command } from "../../src/lib/neutronium/service";
test("environment directory scopes tester accounts, validates URLs, preserves history and restricts access", () => {
  const w = seed();
  const admin: Actor = {
    id: "owner",
    name: "Owner",
    orgId: w.id,
    role: "ORG_OWNER",
    demo: true,
  };
  const environment = {
    name: "Web staging",
    kind: "staging",
    url: "https://staging.example.com",
  };
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:secret@example.com",
    "relative/path",
  ])
    assert.throws(() =>
      command(w, admin, "test-environment-save", { ...environment, url }),
    );
  const id = command(w, admin, "test-environment-save", environment);
  const production = command(w, admin, "test-environment-save", {
    ...environment,
    name: "Web production",
    kind: "production",
    url: "https://example.com",
  });
  const account = {
    environmentId: id,
    label: "QA admin",
    username: "qa@example.com",
    role: "Admin",
    employeeId: w.employees[0].id,
    credentialUrl: "https://vault.example.com/item/1",
  };
  const accountId = command(w, admin, "tester-account-save", account);
  assert.throws(() => command(w, admin, "tester-account-save", account));
  assert.throws(() =>
    command(w, admin, "tester-account-save", {
      ...account,
      id: accountId,
      environmentId: production,
    }),
  );
  assert.throws(() =>
    command(w, admin, "tester-account-save", {
      ...account,
      username: "other",
      employeeId: "foreign-id",
    }),
  );
  assert.throws(() =>
    command(w, admin, "tester-account-save", {
      ...account,
      username: "other",
      credentialUrl: "javascript:alert(1)",
    }),
  );
  command(w, admin, "test-environment-save", {
    ...environment,
    id,
    name: "Updated staging",
    status: "archived",
  });
  assert.equal(w.testEnvironments?.[0].accounts.length, 1);
  assert.throws(() =>
    command(w, admin, "tester-account-save", {
      ...account,
      id: accountId,
      status: "archived",
    }),
  );
  command(w, admin, "test-environment-save", {
    ...environment,
    id,
    status: "active",
  });
  command(w, admin, "tester-account-save", {
    ...account,
    id: accountId,
    status: "archived",
  });
  assert.equal(w.testEnvironments?.[0].accounts[0].status, "archived");
  command(w, admin, "tester-account-save", {
    ...account,
    id: accountId,
    status: "active",
  });
  assert.equal(w.testEnvironments?.[0].accounts[0].status, "active");
  for (const role of [
    "EMPLOYEE",
    "HR_ADMIN",
    "MANAGER",
    "PLATFORM_OWNER",
  ] as const) {
    const actor = { ...admin, role };
    assert.deepEqual(project(w, actor).testEnvironments, []);
    assert.throws(() =>
      command(w, actor, "test-environment-save", environment),
    );
    assert.throws(() => command(w, actor, "tester-account-save", account));
  }
  assert.throws(() =>
    command(
      w,
      { ...admin, orgId: "foreign-org" },
      "test-environment-save",
      environment,
    ),
  );
  assert.equal(project(w, admin).testEnvironments?.length, 2);
  assert.ok(w.audit.some((a) => a.action === "Tester account registered"));
  assert.ok(!JSON.stringify(w.audit).includes("vault.example.com"));
});
