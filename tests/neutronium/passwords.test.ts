import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../../src/lib/neutronium/passwords";
test("password hashes are salted, reject incorrect passwords, and enforce limits", async () => {
  const password = "a-long-test-password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong", first), false);
  assert.equal(await verifyPassword(password, null), false);
  await assert.rejects(hashPassword("short"));
  await assert.rejects(hashPassword("x".repeat(129)));
});
