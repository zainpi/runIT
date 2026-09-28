import assert from "node:assert/strict";
import { test } from "node:test";
import { contactDeliveryConfigured, deliverContact, validateContact } from "../../src/lib/contact";

const valid = { name: "Ada", email: "ada@example.com", topic: "custom", message: "I’d love a template for a recipe app." };

test("accepts a complete message and trims fields", () => {
  const result = validateContact({ ...valid, name: "  Ada  " });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.name, "Ada");
});

test("reports every missing or invalid field", () => {
  const result = validateContact({ name: "", email: "not-an-email", topic: "pricing", message: "hi" });
  assert.equal(result.ok, false);
  if (!result.ok && !result.spam) assert.deepEqual(Object.keys(result.errors).sort(), ["email", "message", "name", "topic"]);
});

test("rejects oversized messages", () => {
  const result = validateContact({ ...valid, message: "x".repeat(5001) });
  assert.equal(result.ok, false);
  if (!result.ok && !result.spam) assert.ok(result.errors.message);
});

test("flags the hidden field as spam without field errors", () => {
  assert.deepEqual(validateContact({ ...valid, website: "https://spam.example" }), { ok: false, spam: true });
});

test("reports delivery as unavailable until Resend is configured", async () => {
  assert.equal(contactDeliveryConfigured({}), false);
  let called = false;
  const result = await deliverContact(validateContactValue(), {}, async () => { called = true; return new Response(null); });
  assert.deepEqual(result, { delivered: false, reason: "not-configured" });
  assert.equal(called, false);
});

test("sends one email with the visitor as reply-to", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const env = { CONTACT_RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "runsIT <contact@runs-it.com>", CONTACT_TO_EMAIL: "team@runs-it.com" };
  const result = await deliverContact(validateContactValue(), env, async (url, init) => {
    requests.push({ url: String(url), init: init! });
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  });
  assert.deepEqual(result, { delivered: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal((requests[0].init.headers as Record<string, string>).Authorization, "Bearer re_test");
  const body = JSON.parse(String(requests[0].init.body));
  assert.deepEqual(body.to, ["team@runs-it.com"]);
  assert.equal(body.reply_to, "ada@example.com");
  assert.match(body.text, /recipe app/);
});

test("treats a provider error or network failure as failed", async () => {
  const env = { CONTACT_RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "contact@runs-it.com" };
  assert.deepEqual(await deliverContact(validateContactValue(), env, async () => new Response("nope", { status: 500 })), { delivered: false, reason: "failed" });
  assert.deepEqual(await deliverContact(validateContactValue(), env, async () => { throw new Error("offline"); }), { delivered: false, reason: "failed" });
});

function validateContactValue() {
  const result = validateContact(valid);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture invalid");
  return result.value;
}
