import test from "node:test";
import assert from "node:assert/strict";
import { emailConfigured } from "../../src/lib/neutronium/email";

test("email configuration recognizes Cloudflare providers and rejects incomplete senders", () => {
  const previous = {
    provider: process.env.NEUTRONIUM_EMAIL_PROVIDER,
    cloudflareToken: process.env.NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN,
    password: process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD,
    accountId: process.env.NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID,
    key: process.env.NEUTRONIUM_EMAIL_API_KEY,
    from: process.env.NEUTRONIUM_EMAIL_FROM,
  };
  try {
    process.env.NEUTRONIUM_EMAIL_PROVIDER = "cloudflare_smtp";
    process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD = "token-for-test";
    process.env.NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN = "";
    process.env.NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID = "";
    process.env.NEUTRONIUM_EMAIL_API_KEY = "";
    process.env.NEUTRONIUM_EMAIL_FROM =
      "Neutronium <welcome@neutronium.runsit.ca>";
    assert.equal(emailConfigured(), true);

    process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD = "";
    assert.equal(emailConfigured(), false);
    process.env.NEUTRONIUM_EMAIL_PROVIDER = "resend";
    process.env.NEUTRONIUM_EMAIL_API_KEY = "resend-for-test";
    assert.equal(emailConfigured(), true);

    process.env.NEUTRONIUM_EMAIL_PROVIDER = "cloudflare_rest";
    process.env.NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN = "token-for-test";
    process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD = "";
    process.env.NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID =
      "0123456789abcdef0123456789abcdef";
    assert.equal(emailConfigured(), true);
    process.env.NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID = "not-an-account-id";
    assert.equal(emailConfigured(), false);

    process.env.NEUTRONIUM_EMAIL_FROM = "not-an-email";
    assert.equal(emailConfigured(), false);
  } finally {
    for (const [key, value] of Object.entries({
      NEUTRONIUM_EMAIL_PROVIDER: previous.provider,
      NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN: previous.cloudflareToken,
      NEUTRONIUM_EMAIL_SMTP_PASSWORD: previous.password,
      NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID: previous.accountId,
      NEUTRONIUM_EMAIL_API_KEY: previous.key,
      NEUTRONIUM_EMAIL_FROM: previous.from,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Cloudflare HTTP success with bounced or suppressed recipients is a delivery failure", async () => {
  const { sendEmail } = await import("../../src/lib/neutronium/email");
  const originalFetch = globalThis.fetch;
  const keys = [
    "NEUTRONIUM_EMAIL_PROVIDER",
    "NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN",
    "NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID",
    "NEUTRONIUM_EMAIL_FROM",
  ];
  const previous = keys.map((k) => process.env[k]);
  try {
    process.env.NEUTRONIUM_EMAIL_PROVIDER = "cloudflare_rest";
    process.env.NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN = "mock-token";
    process.env.NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID = "a".repeat(32);
    process.env.NEUTRONIUM_EMAIL_FROM = "no-reply@example.com";
    const message = {
      from: "no-reply@example.com",
      to: ["recipient@example.com"],
      subject: "Test",
      text: "Test only",
    };
    for (const response of [
      { success: false },
      {
        success: true,
        result: {
          message_id: "test",
          permanent_bounces: ["recipient@example.com"],
        },
      },
      {
        success: true,
        result: {
          message_id: "test",
          suppressed_recipients: ["recipient@example.com"],
        },
      },
    ]) {
      globalThis.fetch = async () => Response.json(response);
      await assert.rejects(sendEmail(message));
    }
    globalThis.fetch = async () =>
      Response.json({
        success: true,
        result: {
          message_id: "test",
          queued: ["recipient@example.com"],
          delivered: [],
          permanent_bounces: [],
          suppressed_recipients: [],
        },
      });
    await sendEmail(message);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  }
});
