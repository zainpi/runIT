import test from "node:test";
import assert from "node:assert/strict";
import { emailConfigured } from "../../src/lib/neutronium/email";

test("email configuration recognizes Cloudflare SMTP and rejects incomplete senders", () => {
  const previous = {
    provider: process.env.NEUTRONIUM_EMAIL_PROVIDER,
    password: process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD,
    key: process.env.NEUTRONIUM_EMAIL_API_KEY,
    from: process.env.NEUTRONIUM_EMAIL_FROM,
  };
  try {
    process.env.NEUTRONIUM_EMAIL_PROVIDER = "cloudflare_smtp";
    process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD = "token-for-test";
    process.env.NEUTRONIUM_EMAIL_API_KEY = "";
    process.env.NEUTRONIUM_EMAIL_FROM =
      "Neutronium <welcome@neutronium.runsit.ca>";
    assert.equal(emailConfigured(), true);

    process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD = "";
    assert.equal(emailConfigured(), false);
    process.env.NEUTRONIUM_EMAIL_PROVIDER = "resend";
    process.env.NEUTRONIUM_EMAIL_API_KEY = "resend-for-test";
    assert.equal(emailConfigured(), true);

    process.env.NEUTRONIUM_EMAIL_FROM = "not-an-email";
    assert.equal(emailConfigured(), false);
  } finally {
    for (const [key, value] of Object.entries({
      NEUTRONIUM_EMAIL_PROVIDER: previous.provider,
      NEUTRONIUM_EMAIL_SMTP_PASSWORD: previous.password,
      NEUTRONIUM_EMAIL_API_KEY: previous.key,
      NEUTRONIUM_EMAIL_FROM: previous.from,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
