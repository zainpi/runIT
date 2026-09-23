import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  accountAuth,
  resendConfirmation,
} from "../../src/lib/neutronium/accounts";
import { postgres } from "../../src/lib/neutronium/postgres";

test("failed signup emails can be retried without changing the recipient or losing earlier links", async (t) => {
  const db = new PGlite();
  const env = {
    NEUTRONIUM_DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
    NEUTRONIUM_EMAIL_PROVIDER: "cloudflare_rest",
    NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN: "mock-token",
    NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    NEUTRONIUM_EMAIL_FROM: "no-reply@example.com",
    NEUTRONIUM_APP_URL: "https://example.com",
  };
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, env);
  t.after(async () => {
    await db.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  await db.exec("create role authenticated; create role neutronium_runtime;");
  for (const migration of [
    "001_initial.sql",
    "002_social_auth.sql",
    "007_employee_applications.sql",
  ]) {
    await db.exec(
      await readFile(`deploy/neutronium/migrations/${migration}`, "utf8"),
    );
  }
  t.mock.method(postgres(), "query", (sql: string, values?: unknown[]) =>
    db.query(sql, values),
  );
  t.mock.method(console, "error", () => {});
  const auth = await accountAuth();
  const returnTo = `/neutronium/join/?token=${"J".repeat(43)}`;
  const password = "An employee test password";
  const sent: { to: string[]; text: string }[] = [];
  let failure: "http" | "suppression" | "network" | null = null;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init: RequestInit) => {
      const message = JSON.parse(String(init.body));
      sent.push(message);
      if (failure === "network") throw new TypeError("Connection lost");
      if (failure === "http")
        return Response.json({ success: false }, { status: 503 });
      return Response.json({
        success: true,
        result: {
          message_id: `test-${sent.length}`,
          queued: failure ? [] : message.to,
          suppressed_recipients: failure ? message.to : [],
        },
      });
    },
  );

  for (const cause of ["http", "suppression", "network"] as const) {
    await t.test(cause, async () => {
      const email = `employee-${cause}@example.com`;
      const signup = () => auth.auth.signUp({ email, password, returnTo });
      const users = () =>
        db.query<{ id: string; verified: boolean }>(
          "select id,verified from neutronium_users where email=$1",
          [email],
        );
      const tokens = () =>
        db.query<{ token_hash: string; return_to: string }>(
          "select token_hash,return_to from neutronium_auth_tokens where user_id=(select id from neutronium_users where email=$1) order by token_hash",
          [email],
        );
      failure = cause;
      await assert.rejects(signup());
      const initial = (await users()).rows;
      assert.equal(initial.length, 1);
      assert.equal(initial[0].verified, false);
      assert.equal((await tokens()).rows.length, 0);
      assert.deepEqual(sent.at(-1)?.to, [email]);

      failure = null;
      assert.equal((await signup()).error, null);
      assert.deepEqual((await users()).rows, initial);
      assert.deepEqual(sent.at(-1)?.to, [email]);
      const link = new URL(sent.at(-1)!.text.split("\n\n").at(-1)!);
      const accepted = (await tokens()).rows;
      assert.deepEqual(accepted, [
        {
          token_hash: createHash("sha256")
            .update(link.searchParams.get("token_hash")!)
            .digest("hex"),
          return_to: returnTo,
        },
      ]);

      failure = cause;
      await assert.rejects(resendConfirmation(email, returnTo));
      assert.deepEqual((await tokens()).rows, accepted);
      failure = null;
      await resendConfirmation(email, returnTo);
      assert.equal((await tokens()).rows.length, 2);
      assert.deepEqual(sent.at(-1)?.to, [email]);
    });
  }
});
