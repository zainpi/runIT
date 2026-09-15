import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  DealIngestPayloadTooLargeError,
  InvalidDealIngestPayloadError,
  MAX_DEAL_INGEST_BYTES,
  normalizeIngestedDeal,
  readBoundedRequestBody,
  verifyDealIngestSignature,
} from "../../src/lib/pulsedeals/ingest";
import { POST } from "../../src/app/pulsedeals/api/v1/internal/deals/route";

const secret = "test-only-pulsedeals-ingest-secret-32-bytes";
const validDeal = {
  asin: "B09XS7JWHH",
  marketplace: "DE",
  title: "Sony wireless headphones",
  currentPrice: 25.129,
  referencePrice: 99.999,
  average90DayPrice: 80.555,
  score: 91.4,
  confidence: 88.7,
  reasoning: "Strong price history and seller quality.",
  seller: "Amazon EU",
  sellerRating: 4.8,
  isFBA: true,
  isPrime: true,
  imageURL: "https://images-na.ssl-images-amazon.com/images/I/example.jpg",
  offerListingID: "offer-123",
  keepaUpdatedAt: "2026-09-11T12:00:00Z",
  routingTier: "major",
};

function signedRequest(body: string, options: { timestamp?: number; signature?: string } = {}): Request {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1_000);
  const signature = options.signature
    ?? `v1=${createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex")}`;
  return new Request("https://runsit.ca/pulsedeals/api/v1/internal/deals", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pulsedeals-ingest-timestamp": String(timestamp),
      "x-pulsedeals-ingest-signature": signature,
    },
    body,
  });
}

test("deal ingest normalization produces a bounded app-feed row", () => {
  const now = new Date("2026-09-11T12:05:30Z");
  const row = normalizeIngestedDeal(validDeal, now);
  assert.deepEqual(row, {
    asin: "B09XS7JWHH",
    marketplace: "de",
    title: "Sony wireless headphones",
    category: "tech",
    current_price: 25.13,
    reference_price: 100,
    average90_day_price: 80.56,
    score: 91,
    confidence: 89,
    reasoning: "Strong price history and seller quality.",
    minutes_ago: 5,
    seller: "Amazon EU",
    seller_rating: 4.8,
    is_fba: true,
    is_prime: true,
    status: "live",
    icon_name: "gamecontroller.fill",
    keepa_updated_at: "2026-09-11T12:00:00.000Z",
    observed_at: "2026-09-11T12:05:30.000Z",
    raw: { source: "keepabot-dealsbrowser", routingTier: "major" },
    updated_at: "2026-09-11T12:05:30.000Z",
    image_url: "https://images-na.ssl-images-amazon.com/images/I/example.jpg",
    offer_listing_id: "offer-123",
  });
});

test("deal ingest rejects malformed identifiers, values, booleans, and image hosts", () => {
  const invalid = [
    { ...validDeal, asin: "short" },
    { ...validDeal, marketplace: "us" },
    { ...validDeal, currentPrice: 0 },
    { ...validDeal, score: 101 },
    { ...validDeal, isFBA: "true" },
    { ...validDeal, imageURL: "https://example.com/untrusted.jpg" },
    { ...validDeal, keepaUpdatedAt: "not-a-date" },
  ];
  for (const payload of invalid) {
    assert.throws(() => normalizeIngestedDeal(payload), InvalidDealIngestPayloadError);
  }
});

test("ingest signatures authenticate the exact body and expire after five minutes", async () => {
  const body = new TextEncoder().encode(JSON.stringify(validDeal));
  const timestamp = 1_800_000_000;
  const signature = `v1=${createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex")}`;
  assert.equal(await verifyDealIngestSignature(body, String(timestamp), signature, secret, timestamp * 1_000), true);
  assert.equal(await verifyDealIngestSignature(body, String(timestamp), signature, `${secret}-wrong`, timestamp * 1_000), false);
  assert.equal(await verifyDealIngestSignature(body, String(timestamp), signature, secret, (timestamp + 301) * 1_000), false);
  assert.equal(await verifyDealIngestSignature(new TextEncoder().encode("{}"), String(timestamp), signature, secret, timestamp * 1_000), false);
});

test("bounded reader rejects a streaming body without relying on content-length", async () => {
  const request = new Request("https://runsit.ca/internal", {
    method: "POST",
    // Node requires duplex for a custom streaming request body.
    duplex: "half",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_DEAL_INGEST_BYTES + 1));
        controller.close();
      },
    }),
  } as RequestInit & { duplex: "half" });
  await assert.rejects(readBoundedRequestBody(request), DealIngestPayloadTooLargeError);
});

test("signed deal route upserts once and rejects bad or malformed requests before storage", async () => {
  const names = [
    "PULSEDEALS_INGEST_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PULSEDEALS_PUSH_ENABLED",
  ];
  const previous = names.map((name) => process.env[name]);
  const originalFetch = globalThis.fetch;
  const calls: Request[] = [];
  try {
    process.env.PULSEDEALS_INGEST_SECRET = secret;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://deal-ingest.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role-key";
    process.env.PULSEDEALS_PUSH_ENABLED = "false";
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      calls.push(request.clone());
      const url = new URL(request.url);
      assert.equal(url.hostname, "deal-ingest.example.test");
      if (url.pathname === "/rest/v1/rpc/enqueue_pulsedeals_push_matches") {
        assert.deepEqual(await request.json(), {
          p_marketplace: "de",
          p_product_id: "com.pulsedeals.subscription.weekly",
        });
        return Response.json(3);
      }
      assert.equal(url.pathname, "/rest/v1/pulsedeals_deals");
      assert.equal(url.searchParams.get("on_conflict"), "asin,marketplace");
      assert.ok(request.headers.get("prefer")?.includes("resolution=merge-duplicates"));
      const stored = await request.json() as Record<string, unknown>;
      assert.equal(stored.asin, validDeal.asin);
      assert.equal(stored.marketplace, "de");
      assert.equal(stored.score, 91);
      assert.deepEqual(stored.raw, { source: "keepabot-dealsbrowser", routingTier: "major" });
      return new Response(null, { status: 201 });
    };

    const accepted = await POST(signedRequest(JSON.stringify(validDeal)));
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), {
      ok: true,
      data: { asin: "B09XS7JWHH", marketplace: "de" },
      queued: 0,
    });
    assert.equal(calls.length, 1);

    process.env.PULSEDEALS_PUSH_ENABLED = "true";
    const pushed = await POST(signedRequest(JSON.stringify(validDeal)));
    assert.equal(pushed.status, 200);
    assert.equal((await pushed.json()).queued, 3);
    assert.equal(calls.length, 3);
    process.env.PULSEDEALS_PUSH_ENABLED = "false";

    const badSignature = await POST(signedRequest(JSON.stringify(validDeal), { signature: `v1=${"0".repeat(64)}` }));
    assert.equal(badSignature.status, 401);
    const malformed = await POST(signedRequest("not-json"));
    assert.equal(malformed.status, 400);
    const invalid = await POST(signedRequest(JSON.stringify({ ...validDeal, marketplace: "ca" })));
    assert.equal(invalid.status, 422);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
