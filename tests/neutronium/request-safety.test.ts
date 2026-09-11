import test from "node:test";
import assert from "node:assert/strict";
import { DomainError, seed, type Actor } from "../../src/lib/neutronium/model";
import {
  readJsonBody,
  MAX_REQUEST_BYTES,
} from "../../src/lib/neutronium/request-body";
import { command } from "../../src/lib/neutronium/service";
import {
  isHttpsUrl,
  isCalendarDate,
  isUuid,
} from "../../src/lib/neutronium/validation";
import { sameOrigin } from "../../src/lib/neutronium/auth";

const json = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://example.test/neutronium/api/settings/", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
const status = (expected: number) => (error: unknown) =>
  error instanceof DomainError && error.status === expected;

test("JSON input enforces media type, object shape, nesting and unsafe property limits", async () => {
  for (const raw of ["{", "null", "[]", "true", '"hello"'])
    await assert.rejects(readJsonBody(json(raw)), status(400));
  await assert.rejects(
    readJsonBody(json("{}", { "content-type": "text/plain" })),
    status(415),
  );
  for (const raw of [
    '{"__proto__":{"admin":true}}',
    '{"fields":{"constructor":{}}}',
    '{"name":"bad\\u0000text"}',
  ])
    await assert.rejects(readJsonBody(json(raw)), status(400));
  await assert.rejects(
    readJsonBody(json('{"a":'.repeat(22) + "{}" + "}".repeat(22))),
    status(400),
  );
  const input = {
    name: "O’Neil <script>alert(1)</script>",
    note: "First line\nSecond line\t✓",
  };
  assert.deepEqual(await readJsonBody(json(JSON.stringify(input))), input);
});

test("body limit measures bytes and cancels a chunked upload before buffering all of it", async () => {
  await assert.rejects(
    readJsonBody(
      json("{}", { "content-length": String(MAX_REQUEST_BYTES + 1) }),
    ),
    status(413),
  );
  await assert.rejects(
    readJsonBody(json(JSON.stringify({ value: "🌍".repeat(30_000) }))),
    status(413),
  );
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(60_000).fill(32));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readJsonBody(request), status(413));
  assert.equal(cancelled, true);
  assert.deepEqual(
    await readJsonBody(
      json(
        JSON.stringify({
          attachment: { data: Buffer.alloc(50_000).toString("base64") },
        }),
      ),
    ),
    { attachment: { data: Buffer.alloc(50_000).toString("base64") } },
  );
});

test("URLs and calendar dates reject normalization tricks while preserving valid links", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.com",
    "https://u:p@example.com",
    "https://exa\nmple.com",
    "https://example.com\\@evil.test",
    "https://example.com/a b",
  ])
    assert.equal(isHttpsUrl(value), false, value);
  assert.equal(isHttpsUrl("https://password.link/item#one-time-token"), true);
  for (const value of [
    "2026-02-30",
    "2026-13-01",
    "2026-09-11T00:00:00Z",
    "tomorrow",
  ])
    assert.equal(isCalendarDate(value), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isUuid("------------------------------------"), false);
  assert.equal(isUuid("abcdefabcdefabcdefabcdefabcdefabcdef"), false);
  assert.equal(isUuid(seed().id), true);
});

test("domain validation returns useful input errors for malformed records and coerced permissions", () => {
  const w = seed();
  const a: Actor = {
    id: "admin",
    name: "Admin",
    orgId: w.id,
    role: "ORG_OWNER",
    demo: true,
  };
  for (const row of [null, false, [], "employee"])
    assert.throws(
      () => command(w, a, "import", { employees: [row] }),
      status(400),
    );
  const request = {
    employeeId: w.employees[0].id,
    applicationId: w.applications[2].id,
    level: "Standard",
    reason: "Testing",
  };
  for (const durationMinutes of [null, false, [], {}, "", "1.5", -1, Infinity])
    assert.throws(
      () => command(w, a, "request", { ...request, durationMinutes }),
      status(400),
    );
  assert.throws(
    () =>
      command(w, a, "test-environment-save", {
        name: "Bad\u0000name",
        kind: "staging",
        url: "https://example.com",
      }),
    status(400),
  );
  assert.equal(w.testEnvironments?.length || 0, 0);
});

test("same-origin enforcement rejects missing, sibling and hostile origins", (t) => {
  const previous = process.env.NEUTRONIUM_APP_URL;
  process.env.NEUTRONIUM_APP_URL = "https://neutronium.example.test";
  t.after(() => {
    if (previous === undefined) delete process.env.NEUTRONIUM_APP_URL;
    else process.env.NEUTRONIUM_APP_URL = previous;
  });
  for (const origin of [
    undefined,
    "null",
    "https://attacker.test",
    "https://other.example.test",
    "https://neutronium.example.test.attacker.test",
  ])
    assert.throws(
      () =>
        sameOrigin(
          new Request("https://neutronium.example.test/api", {
            headers: origin ? { origin } : {},
          }),
        ),
      status(403),
    );
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("https://neutronium.example.test/api", {
        headers: { origin: "https://neutronium.example.test" },
      }),
    ),
  );
});
