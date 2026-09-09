import test from "node:test";
import assert from "node:assert/strict";
import { connectionRequest } from "../../src/lib/neutronium/connections";
test("connection destinations reject arbitrary hosts and header injection", () => {
  for (const scope of [
    "evil.com",
    "company.atlassian.net/evil",
    "company.atlassian.net@evil.com",
    "https://company.atlassian.net",
  ])
    assert.throws(() =>
      connectionRequest("jira", { scope, token: "secret", email: "a@b.com" }),
    );
  assert.throws(() =>
    connectionRequest("github", { scope: "../../metadata", token: "secret" }),
  );
  assert.throws(() =>
    connectionRequest("vercel", { token: "secret\r\nInjected: yes" }),
  );
  assert.equal(
    new URL(
      connectionRequest("jira", {
        scope: "company.atlassian.net",
        email: "a@b.com",
        token: "secret",
      }).url,
    ).hostname,
    "company.atlassian.net",
  );
  assert.equal(
    new URL(
      connectionRequest("vercel", { token: "secret", scope: "a&x=y" }).url,
    ).searchParams.get("teamId"),
    "a&x=y",
  );
});
