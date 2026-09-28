import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import { refreshOpenedDeal } from "../../src/lib/pulsedeals/keepa";

function fakeDealStore(keepaUpdatedAt: string | null = null) {
  let patch: Record<string, unknown> | null = null;
  // This focused fake implements only the Supabase chain used by this refresh.
  const admin = Object.assign(Object.create(null), {
    from(table: string) {
      assert.equal(table, "pulsedeals_deals");
      return {
        select() {
          return {
            eq() { return this; },
            async maybeSingle() {
              return { data: { current_price: 35, reference_price: 50, is_prime: true, keepa_updated_at: keepaUpdatedAt }, error: null };
            },
          };
        },
        update(value: Record<string, unknown>) {
          patch = value;
          return {
            eq() { return this; },
            async or() { return { error: null }; },
          };
        },
      };
    },
  }) as SupabaseClient;
  return { admin, getPatch: () => patch };
}

test("an Amazon handoff refresh updates the NEW price and expires a reverted deal", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  const keepaMinute = Math.floor((Date.UTC(2026, 8, 24) - Date.UTC(2011, 0, 1)) / 60_000);
  let newPriceCents = 7999;
  process.env.KEEPA_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("update"), "0");
    assert.equal(url.searchParams.get("domain"), "3");
    assert.equal(url.searchParams.get("asin"), "B012345678");
    return Response.json({ products: [{ asin: "B012345678", lastUpdate: keepaMinute,
      stats: { current: [1999, newPriceCents] }, csv: [null, [keepaMinute, newPriceCents]] }] });
  };
  try {
    const store = fakeDealStore();
    await refreshOpenedDeal(store.admin, "de", "B012345678");
    assert.equal(store.getPatch()?.current_price, 79.99);
    assert.equal(store.getPatch()?.status, "burnedOut");
    assert.deepEqual(store.getPatch()?.price_history, [{ date: "2026-09-24T00:00:00.000Z", price: 79.99 }]);

    newPriceCents = 2499;
    const cheaperStore = fakeDealStore();
    await refreshOpenedDeal(cheaperStore.admin, "de", "B012345678");
    assert.equal(cheaperStore.getPatch()?.current_price, 24.99);
    assert.equal(cheaperStore.getPatch()?.status, "live");

    newPriceCents = -1;
    const outOfStockStore = fakeDealStore();
    await refreshOpenedDeal(outOfStockStore.admin, "de", "B012345678");
    assert.equal(outOfStockStore.getPatch()?.current_price, 35);
    assert.equal(outOfStockStore.getPatch()?.status, "burnedOut");

    const newerStore = fakeDealStore("2026-09-25T00:00:00.000Z");
    await refreshOpenedDeal(newerStore.admin, "de", "B012345678");
    assert.equal(newerStore.getPatch(), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KEEPA_API_KEY;
    else process.env.KEEPA_API_KEY = originalKey;
  }
});
