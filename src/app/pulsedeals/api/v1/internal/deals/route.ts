import { getPulseDealsEnv } from "@/lib/pulsedeals/compatibility";
import {
  DealIngestPayloadTooLargeError,
  InvalidDealIngestPayloadError,
  normalizeIngestedDeal,
  readBoundedRequestBody,
  verifyDealIngestSignature,
} from "@/lib/pulsedeals/ingest";
import { apiError, apiJson, getAdminClient, getProductID, handleApiError } from "@/lib/pulsedeals/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = getPulseDealsEnv("PULSEDEALS_INGEST_SECRET");
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    return apiError(request, 503, "ingest_not_configured", "Deal ingestion is not configured.");
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readBoundedRequestBody(request);
  } catch (error) {
    if (error instanceof DealIngestPayloadTooLargeError) {
      return apiError(request, 413, "payload_too_large", "The deal payload is too large.");
    }
    return handleApiError(request, error);
  }

  const authorized = await verifyDealIngestSignature(
    rawBody,
    request.headers.get("x-pulsedeals-ingest-timestamp"),
    request.headers.get("x-pulsedeals-ingest-signature"),
    secret,
  );
  if (!authorized) return apiError(request, 401, "unauthorized", "Internal endpoint only.");

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return apiError(request, 400, "invalid_request", "The deal payload is not valid JSON.");
  }

  let deal;
  try {
    deal = normalizeIngestedDeal(body);
  } catch (error) {
    if (error instanceof InvalidDealIngestPayloadError) {
      return apiError(request, 422, "invalid_deal", "The deal payload is invalid.");
    }
    return handleApiError(request, error);
  }

  try {
    const admin = getAdminClient();
    const upsert = await admin.from("pulsedeals_deals").upsert(deal, { onConflict: "asin,marketplace" });
    if (upsert.error) throw upsert.error;

    let queued = 0;
    if (getPulseDealsEnv("PULSEDEALS_PUSH_ENABLED") === "true") {
      const enqueue = await admin.rpc("enqueue_pulsedeals_push_matches", {
        p_marketplace: deal.marketplace,
        p_product_id: getProductID(),
      });
      if (enqueue.error) throw enqueue.error;
      queued = Number(enqueue.data ?? 0);
    }
    return apiJson(request, { ok: true, data: { asin: deal.asin, marketplace: deal.marketplace }, queued });
  } catch (error) {
    return handleApiError(request, error);
  }
}
