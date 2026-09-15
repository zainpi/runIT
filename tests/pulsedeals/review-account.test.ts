import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateReviewAccount, getReviewAccountConfig } from "../../src/lib/pulsedeals/server";

const account = {
  id: "11111111-1111-4111-8111-111111111111",
  apple_sub: "pulsedeals-review:reviewer@example.test",
  app_account_token: "22222222-2222-4222-8222-222222222222",
  email: "reviewer@example.test",
};

function clientForNewAccount(calls: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      assert.equal(table, "pulsedeals_accounts");
      let values: Record<string, unknown> = {};
      const query = {
        select() { return query; },
        eq() { return query; },
        maybeSingle: async () => ({ data: null, error: null }),
        insert(value: Record<string, unknown>) { values = value; return query; },
        single: async () => ({ data: { ...account, ...values }, error: null }),
      };
      return query;
    },
    async rpc(name: string, params: Record<string, unknown>) {
      calls.push({ name, ...params });
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
}

test("review credentials provision an active Pro entitlement through the normal RPC", async () => {
  const names = ["PULSEDEALS_REVIEW_USERNAME", "PULSEDEALS_REVIEW_PASSWORD", "PULSEDEALS_REVIEW_PRODUCT_ID"];
  const previous = names.map((name) => process.env[name]);
  const calls: Array<Record<string, unknown>> = [];
  try {
    process.env.PULSEDEALS_REVIEW_USERNAME = "reviewer@example.test";
    process.env.PULSEDEALS_REVIEW_PASSWORD = "local-review-password";
    delete process.env.PULSEDEALS_REVIEW_PRODUCT_ID;

    const result = await authenticateReviewAccount(
      clientForNewAccount(calls),
      " REVIEWER@EXAMPLE.TEST ",
      "local-review-password",
      "33333333-3333-4333-8333-333333333333",
    );
    assert.equal(result.id, account.id);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "record_pulsedeals_apple_entitlement");
    assert.equal(calls[0].p_account_id, account.id);
    assert.equal(calls[0].p_status, "active");
    assert.deepEqual(calls[0].p_transaction, {
      productId: "com.pulsedeals.subscription.pro.weekly",
      originalTransactionId: "pulsedeals-review:reviewer@example.test",
      transactionId: "pulsedeals-review:reviewer@example.test",
      appAccountToken: "33333333-3333-4333-8333-333333333333",
      environment: "Production",
      expiresDate: Date.parse("2100-01-01T00:00:00.000Z"),
      signedDate: (calls[0].p_transaction as { signedDate: number }).signedDate,
    });
    assert.equal((calls[0].p_transaction as { signedDate: number }).signedDate > 0, true);

    await assert.rejects(
      authenticateReviewAccount(clientForNewAccount([]), "reviewer@example.test", "wrong", "33333333-3333-4333-8333-333333333333"),
      /Invalid reviewer credentials/,
    );
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test("review-account configuration fails closed when credentials are absent", () => {
  const names = ["PULSEDEALS_REVIEW_USERNAME", "PULSEDEALS_REVIEW_PASSWORD"];
  const previous = names.map((name) => process.env[name]);
  try {
    names.forEach((name) => delete process.env[name]);
    assert.throws(() => getReviewAccountConfig(), /PULSEDEALS_REVIEW_USERNAME/);
    process.env.PULSEDEALS_REVIEW_USERNAME = "reviewer@example.test";
    assert.throws(() => getReviewAccountConfig(), /PULSEDEALS_REVIEW_PASSWORD/);
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
