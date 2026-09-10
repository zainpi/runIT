import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { sendPush, type PushRequest, type PushResult } from "./apns";

type Row = Record<string, any>; // Supabase rows are validated against current database state below.
export function stillMatches(delivery: Row, device: Row | null, alert: Row | null, deal: Row | null, entitled: boolean, now = Date.now()): boolean {
  if (!device?.enabled || device.account_id !== delivery.account_id || !alert?.is_enabled ||
      alert.account_id !== delivery.account_id || !entitled || !deal || deal.status !== "live" ||
      new Date(delivery.expires_at).getTime() <= now || Number(deal.current_price) !== Number(delivery.price)) return false;
  const price = Number(deal.current_price), reference = Number(deal.reference_price);
  const source = `${deal.title} ${deal.category} ${deal.asin}`.toLowerCase();
  return Number.isFinite(price) && reference > price && price > 0 && deal.marketplace === alert.marketplace &&
    (!alert.categories?.length || alert.categories.includes(deal.category)) &&
    Math.round((reference - price) / reference * 100) >= alert.min_discount && deal.score >= alert.min_heat &&
    (alert.min_price == null || price >= Number(alert.min_price)) &&
    (alert.max_price == null || price <= Number(alert.max_price)) &&
    (!alert.prime_only || deal.is_prime) && (!alert.fba_only || deal.is_fba) &&
    String(alert.keyword ?? "").trim().toLowerCase().split(/\s+/).every(word => source.includes(word));
}

export async function dispatchOnce(admin: SupabaseClient, sender: (request: PushRequest) => Promise<PushResult> = sendPush): Promise<number> {
  const claimed = await admin.rpc("claim_heater_push_deliveries", { p_limit: 5 });
  if (claimed.error) throw claimed.error;
  let sent = 0;
  for (const delivery of (claimed.data ?? []) as Row[]) {
    // Every state write uses the lease token so a timed-out worker cannot overwrite a newer attempt.
    const update = async (patch: Row) => {
      const result = await admin.from("heater_push_deliveries").update(patch)
        .eq("id", delivery.id).eq("lease_token", delivery.lease_token);
      if (result.error) throw result.error;
    };
    try {
      const [deviceResult, alertResult, dealResult, entitlementResult] = await Promise.all([
        admin.from("heater_push_devices").select("*").eq("id", delivery.device_id).maybeSingle(),
        admin.from("heater_alerts").select("*").eq("id", delivery.alert_id).maybeSingle(),
        admin.from("heater_deals").select("*").eq("id", delivery.deal_id).maybeSingle(),
        admin.rpc("heater_membership", { p_account_id: delivery.account_id }),
      ]);
      for (const result of [deviceResult, alertResult, dealResult, entitlementResult]) if (result.error) throw result.error;
      const device = deviceResult.data;
      const membership = entitlementResult.data?.[0];
      const allowed = membership?.tier === "pro" || (membership?.tier === "standard" && membership.primary_marketplace === dealResult.data?.marketplace);
      if (!stillMatches(delivery, device, alertResult.data, dealResult.data, allowed)) {
        await update({ state: "cancelled", last_error: "no_longer_matches", lease_until: null });
        continue;
      }
      const result = await sender({ token: device!.token, environment: device!.environment,
        payload: delivery.payload, id: delivery.id, expiresAt: delivery.expires_at });
      if (result.status === 200) {
        await update({ state: "sent", sent_at: new Date().toISOString(), last_error: null, lease_until: null });
        sent++;
      } else {
        const invalidDevice = result.status === 410 || ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(result.reason ?? "");
        if (invalidDevice) {
          const disabled = await admin.from("heater_push_devices").update({ enabled: false }).eq("id", device!.id).eq("token", device!.token);
          if (disabled.error) throw disabled.error;
        }
        const retryable = result.status === 429 || result.status >= 500 || result.reason === "ExpiredProviderToken";
        await update({ state: retryable && delivery.attempts < 5 ? "pending" : "failed",
          next_attempt_at: new Date(Date.now() + 30_000 * 2 ** delivery.attempts).toISOString(),
          last_error: `apns_${result.status}_${result.reason ?? "unknown"}`, lease_until: null });
      }
    } catch {
      // Do not log device tokens, signing material, payloads, or database error details.
      await update({ state: delivery.attempts < 5 ? "pending" : "failed",
        next_attempt_at: new Date(Date.now() + 30_000 * 2 ** delivery.attempts).toISOString(),
        last_error: "delivery_unavailable", lease_until: null });
    }
  }
  // Keep expiry and exhausted crash retries from leaving apparently active deliveries forever.
  const expired = await admin.from("heater_push_deliveries").update({ state: "cancelled", last_error: "expired" })
    .in("state", ["pending", "sending"]).lt("expires_at", new Date().toISOString());
  if (expired.error) throw expired.error;
  const exhausted = await admin.from("heater_push_deliveries").update({ state: "failed", last_error: "retries_exhausted" })
    .eq("state", "sending").gte("attempts", 5).lt("lease_until", new Date().toISOString());
  if (exhausted.error) throw exhausted.error;
  return sent;
}

async function main() {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "HEATERDEALS_APNS_KEY_ID", "HEATERDEALS_APNS_TEAM_ID", "HEATERDEALS_APNS_PRIVATE_KEY"]) {
    if (!process.env[name]) throw new Error(`Missing configuration: ${name}`);
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let running = true;
  process.on("SIGTERM", () => { running = false; });
  process.on("SIGINT", () => { running = false; });
  do {
    try { console.info(`Deal notifications sent: ${await dispatchOnce(admin)}`); }
    catch { console.error("Deal notification dispatch failed; will retry."); }
    if (process.argv.includes("--once")) break;
    if (running) await new Promise(resolve => setTimeout(resolve, 10_000));
  } while (running);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Notification dispatcher configuration is incomplete."); process.exitCode = 1; });
}
