import test from "node:test";
import assert from "node:assert/strict";
import { requestJson, RequestError } from "../../src/app/neutronium/http";

test("repeated clicks share a pending write and later intentional writes still work", async (t) => {
  let finish!: (response: Response) => void;
  let calls = 0;
  t.mock.method(globalThis, "fetch", () => {
    calls++;
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  const input = { method: "POST", body: '{"name":"QA"}' };
  const requests = Array.from({ length: 25 }, () =>
    requestJson("/test/write", input),
  );
  assert.equal(calls, 1);
  finish(Response.json({ ok: true }));
  assert.equal((await Promise.all(requests)).length, 25);
  const next = requestJson("/test/write", input);
  assert.equal(calls, 2);
  finish(Response.json({ ok: true }));
  await next;
});

test("HTML, invalid success bodies and offline errors have safe messages and no automatic retries", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>Gateway error</html>", { status: 503 }),
  );
  await assert.rejects(
    requestJson("/test/html"),
    /couldn’t complete this request/,
  );
  fetch.mock.mockImplementation(async () => Response.json(["unexpected"]));
  await assert.rejects(
    requestJson("/test/shape"),
    /couldn’t complete this request/,
  );
  fetch.mock.mockImplementation(async () => {
    throw new TypeError("network down");
  });
  await assert.rejects(
    requestJson("/test/offline", { method: "POST", body: "{}" }),
    /check whether your changes were saved/,
  );
  assert.equal(fetch.mock.callCount(), 3);
});

test("server backoff prevents repeated requests until Retry-After expires", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: "Slow down" },
      { status: 429, headers: { "Retry-After": "120" } },
    ),
  );
  await assert.rejects(
    requestJson("/test/limited"),
    (e: unknown) =>
      e instanceof RequestError &&
      e.status === 429 &&
      e.retryAfterSeconds === 120,
  );
  await assert.rejects(requestJson("/test/limited"), /Wait 120 seconds/);
  assert.equal(fetch.mock.callCount(), 1);
  now += 121_000;
  fetch.mock.mockImplementation(async () => Response.json({ ok: true }));
  assert.deepEqual(await requestJson("/test/limited"), { ok: true });
  assert.equal(fetch.mock.callCount(), 2);
});

test("hung reads time out, abort their fetch and release the pending request", async (t) => {
  let expire!: () => void;
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => {
    expire = callback;
    return 1;
  });
  t.mock.method(globalThis, "clearTimeout", () => {});
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      }),
  );
  const request = requestJson("/test/hung");
  const rejection = assert.rejects(request, /took too long/);
  expire();
  await rejection;
  fetch.mock.mockImplementation(async () => Response.json({ ok: true }));
  assert.deepEqual(await requestJson("/test/hung"), { ok: true });
});

test("a post-save refresh starts a new read even if an older snapshot is still loading", async (t) => {
  const reads: Array<(response: Response) => void> = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      if (init.method === "POST") return Response.json({ ok: true });
      return new Promise<Response>((resolve) => reads.push(resolve));
    },
  );
  const old = requestJson("/test/state");
  await requestJson("/test/save", { method: "POST", body: "{}" });
  const fresh = requestJson("/test/state");
  assert.equal(reads.length, 2);
  reads[0](Response.json({ revision: 0 }));
  await old;
  const shared = requestJson("/test/state");
  assert.equal(reads.length, 2);
  reads[1](Response.json({ revision: 1 }));
  assert.deepEqual(await fresh, { revision: 1 });
  assert.deepEqual(await shared, { revision: 1 });
});
