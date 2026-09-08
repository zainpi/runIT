import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "../../src/lib/neutronium/model";
import {
  MicrosoftProvider,
  executeStep,
  microsoftWorkflowMarker,
} from "../../src/lib/neutronium/providers";
import { command } from "../../src/lib/neutronium/service";
class RecordingMicrosoft extends MicrosoftProvider {
  calls: { path: string; method: string; body: unknown }[] = [];
  responses: any[] = [];
  override async graph(
    path: string,
    _feature: any,
    method = "GET",
    body?: unknown,
  ) {
    this.calls.push({ path, method, body });
    return this.responses.shift() || {};
  }
}
test("Microsoft identity retries recover only the matching workflow marker", async () => {
  const w = seed();
  const provider = new RecordingMicrosoft(w);
  const employee = w.employees[0];
  provider.responses = [
    { id: "existing-id", employeeId: microsoftWorkflowMarker("job-123") },
  ];
  assert.equal(
    (await provider.createIdentity(employee, "job-123")).reference,
    "existing-id",
  );
  assert.equal(provider.calls.length, 1);
  provider.responses = [{ id: "different-user", employeeId: "somebody-else" }];
  await assert.rejects(
    provider.createIdentity(employee, "job-123"),
    /existing Microsoft account/,
  );
  assert(provider.calls.every((c) => c.method === "GET"));
});
test("preexisting untracked Microsoft access is not taken over for automatic revocation", async () => {
  const w = seed();
  const provider = new RecordingMicrosoft(w);
  provider.responses = [{ id: w.employees[0].providerId }];
  const result = await provider.grant(
    w.employees[0],
    { ...w.applications[0], groupId: "00000000-0000-0000-0000-000000000001" },
    "Standard",
  );
  assert.equal(result.status, "manual_required");
  assert.equal(result.reference, undefined);
  assert(provider.calls.every((c) => c.method === "GET"));
});
test("Microsoft membership removal uses the safe reference-only endpoint", async () => {
  const w = seed();
  const provider = new RecordingMicrosoft(w);
  await provider.revoke(w.employees[0], w.applications[0], "group-id");
  assert.equal(provider.calls[0].method, "DELETE");
  assert(provider.calls[0].path.endsWith("/$ref"));
});
test("production organizations refuse a development application adapter", async () => {
  const w = seed();
  command(
    w,
    { id: "owner", name: "Owner", role: "ORG_OWNER", orgId: w.id, demo: true },
    "onboard",
    {
      firstName: "Sam",
      lastName: "Lee",
      email: "sam@acme.example",
      department: "Engineering",
      startDate: "2026-09-08",
      templateId: w.templates[0].id,
    },
  );
  w.demo = false;
  await assert.rejects(
    executeStep(w, w.jobs[0], w.jobs[0].steps[1]),
    /Development providers cannot run/,
  );
});

test("new Microsoft identities use a stable marker within the provider field limit", async () => {
  const w = seed();
  const provider = new RecordingMicrosoft(w);
  provider.responses = [{ absent: true }, { id: "new-microsoft-user" }];
  const result = await provider.createIdentity(
    w.employees[0],
    "0b81cb8b-b1cc-46b1-8d4b-67145a31f7ce",
  );
  const payload = provider.calls.find((c) => c.method === "POST")!.body as {
    employeeId: string;
    passwordProfile: { password: string };
  };
  assert.equal(payload.employeeId.length, 16);
  assert.equal(
    payload.employeeId,
    microsoftWorkflowMarker("0b81cb8b-b1cc-46b1-8d4b-67145a31f7ce"),
  );
  assert.equal(result.reference, "new-microsoft-user");
  assert(!JSON.stringify(result).includes(payload.passwordProfile.password));
});
