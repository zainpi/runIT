import { AppStoreServerAPIClient, Environment, PromotionalOfferSignatureCreator } from "@apple/app-store-server-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entitlementStatus, verifyRenewalInfo, verifyTransaction } from "./apple";
import { apiError, getMembership, handleApiError } from "./server";

export const REFERRAL_OFFER_ID = "referral-week";
const RETRY_DELAY = 25 * 60 * 60 * 1000;

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-F0-9]{12}$/.test(code) ? code : null;
}

export function referralConfig() {
  const key = process.env.PULSEDEALS_APPLE_OFFER_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const keyId = process.env.PULSEDEALS_APPLE_OFFER_KEY_ID;
  const issuerId = process.env.PULSEDEALS_APPLE_ISSUER_ID;
  if (process.env.PULSEDEALS_REFERRALS_ENABLED !== "true" || !key || !keyId || !issuerId) {
    throw new Error("Referral program unavailable");
  }
  const environment = process.env.PULSEDEALS_REFERRAL_ENVIRONMENT === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
  return { key, keyId, issuerId, environment, bundleId: process.env.PULSEDEALS_BUNDLE_ID ?? "com.pulsedeals.app" };
}

type Redemption = {
  id: string; product_id: string; environment: Environment; original_transaction_id: string;
  offer_id: string; nonce: string; issued_at: number; created_at: string;
  applied_at: string | null; voided_at: string | null; referral_id: string;
};

function redemptionRow(data: Redemption | Redemption[]): Redemption {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value?.id) throw new Error("Referral reservation missing");
  return value;
}

export async function referralSummary(admin: SupabaseClient, accountID: string) {
  const config = referralConfig();
  // Reconcile the external membership before deciding whether Apple redemption
  // would create a second subscription alongside paid Discord access.
  await getMembership(admin, accountID);
  const result = await admin.rpc("pulsedeals_referral_summary", { p_account_id: accountID, p_environment: config.environment });
  if (result.error) throw result.error;
  if (!result.data?.code) throw new Error("Referral account missing");
  return { ...result.data, shareURL: `https://runsit.ca/pulsedeals/invite/${result.data.code}/` };
}

// Recover cancellations/timeouts without trusting a client's purchase status.
// An expired signature may already have scheduled a future free renewal, so
// complete history alone is insufficient: inspect signed renewal info as well.
export async function reconcileReferralOffer(admin: SupabaseClient, accountID: string, pending: Redemption, dependencies?: {
  api: Pick<AppStoreServerAPIClient, "getTransactionHistory" | "getAllSubscriptionStatuses">;
  transaction: typeof verifyTransaction;
  renewal: typeof verifyRenewalInfo;
}): Promise<boolean> {
  const config = referralConfig();
  if (pending.environment !== config.environment) throw new Error("Referral environment mismatch");
  const api = dependencies?.api ?? new AppStoreServerAPIClient(config.key, config.keyId, config.issuerId, config.bundleId, config.environment);
  const verifySignedTransaction = dependencies?.transaction ?? verifyTransaction;
  const verifySignedRenewal = dependencies?.renewal ?? verifyRenewalInfo;
  const account = await admin.from("pulsedeals_accounts").select("app_account_token").eq("id", accountID).single();
  if (account.error) throw account.error;
  const token = (account.data.app_account_token as string).toLowerCase();
  let revision: string | null = null;
  let pages = 0;
  while (true) {
    const page = await api.getTransactionHistory(pending.original_transaction_id, revision, { startDate: Date.parse(pending.created_at) - 1000 });
    for (const signed of page.signedTransactions ?? []) {
      const tx = await verifySignedTransaction(signed);
      if (tx.environment !== pending.environment || tx.appAccountToken?.toLowerCase() !== token || tx.productId !== pending.product_id) continue;
      const recorded = await admin.rpc("record_pulsedeals_apple_entitlement", { p_account_id: accountID, p_transaction: tx, p_status: entitlementStatus(tx) });
      if (recorded.error) throw recorded.error;
    }
    if (!page.hasMore) break;
    if (!page.revision || page.revision === revision || ++pages >= 100) throw new Error("Referral reconciliation incomplete");
    revision = page.revision;
  }
  const applied = await admin.from("pulsedeals_referral_redemptions").select("applied_at").eq("id", pending.id).single();
  if (applied.error) throw applied.error;
  if (applied.data.applied_at) return true;
  const status = await api.getAllSubscriptionStatuses(pending.original_transaction_id);
  let foundSubscription = false;
  let scheduled = false;
  for (const group of status.data ?? []) for (const entry of group.lastTransactions ?? []) {
    if (!entry.signedRenewalInfo || !entry.signedTransactionInfo) throw new Error("Referral reconciliation incomplete");
    const [renewal, tx] = await Promise.all([
      verifySignedRenewal(entry.signedRenewalInfo, config.environment), verifySignedTransaction(entry.signedTransactionInfo),
    ]);
    if (renewal.originalTransactionId !== tx.originalTransactionId || tx.environment !== pending.environment) throw new Error("Referral reconciliation incomplete");
    if (tx.appAccountToken?.toLowerCase() !== token) continue;
    foundSubscription = true;
    const recorded = await admin.rpc("record_pulsedeals_apple_entitlement", { p_account_id: accountID, p_transaction: tx, p_status: entitlementStatus(tx) });
    if (recorded.error) throw recorded.error;
    if (renewal.offerType === 2 && renewal.offerIdentifier === pending.offer_id) scheduled = true;
  }
  if (!foundSubscription) throw new Error("Referral reconciliation incomplete");
  const refreshed = await admin.from("pulsedeals_referral_redemptions").select("applied_at").eq("id", pending.id).single();
  if (refreshed.error) throw refreshed.error;
  return scheduled || Boolean(refreshed.data.applied_at);
}

export async function prepareReferralOffer(admin: SupabaseClient, accountID: string) {
  const config = referralConfig();
  // Instantiate the signer before reserving a credit; invalid keys cannot strand it.
  const signer = new PromotionalOfferSignatureCreator(config.key, config.keyId, config.bundleId);
  const account = await admin.from("pulsedeals_accounts").select("app_account_token").eq("id", accountID).single();
  if (account.error) throw account.error;
  const result = await admin.rpc("reserve_pulsedeals_referral_week", { p_account_id: accountID, p_environment: config.environment });
  if (result.error) throw result.error;
  let pending = redemptionRow(result.data);
  if (pending.environment !== config.environment) throw new Error("Referral environment mismatch");
  if (Date.now() - Number(pending.issued_at) >= RETRY_DELAY) {
    if (await reconcileReferralOffer(admin, accountID, pending)) throw new Error("Referral offer already applied or scheduled");
    const retried = await admin.rpc("retry_pulsedeals_referral_week", {
      p_account_id: accountID, p_id: pending.id, p_previous_issued_at: pending.issued_at,
    });
    if (retried.error) throw retried.error;
    pending = redemptionRow(retried.data);
    if (pending.voided_at) throw new Error("Referral credit revoked");
  }
  // Reuse the same nonce and timestamp for HTTP retries; Apple accepts it only
  // once. A second device cannot obtain a second spendable signature.
  if (Date.now() - Number(pending.issued_at) >= 24 * 60 * 60 * 1000) throw new Error("Referral offer awaiting Apple confirmation");
  const validCredit = await admin.from("pulsedeals_referrals").select("revoked_at").eq("id", pending.referral_id).single();
  if (validCredit.error) throw validCredit.error;
  if (validCredit.data.revoked_at) throw new Error("Referral credit revoked");
  const token = (account.data.app_account_token as string).toLowerCase();
  return {
    redemptionID: pending.id, productID: pending.product_id, offerID: pending.offer_id,
    keyID: config.keyId, nonce: pending.nonce, timestamp: Number(pending.issued_at),
    signature: signer.createSignature(pending.product_id, pending.offer_id, token, pending.nonce, Number(pending.issued_at)),
  };
}

export function referralError(request: Request, error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const messages: Record<string, [number, string]> = {
    "Referral program unavailable": [503, "Referrals are not available yet. Please try again later."],
    "Referral code not found": [404, "That referral code wasn’t found. Check the code and try again."],
    "Referral cannot be your own code": [422, "Use the code of the friend who invited you."],
    "Referral already claimed": [409, "You’ve already added a friend’s referral code."],
    "Referral requires a new user before their first subscription": [409, "Referral codes are for new users before their first subscription."],
    "Referral credit needs an Apple subscription": [409, "Your weeks are saved. Redeem them with an existing or previous Apple subscription."],
    "Referral credit cannot change Discord billing": [409, "Your weeks are saved for Apple billing. Your Discord subscription is managed separately."],
    "Referral credit unavailable": [409, "No free weeks are available yet. Share your code to get started."],
    "Referral credit revoked": [409, "This referral’s trial was revoked. An outstanding reservation clears after its retry time and Apple verification."],
    "Referral offer already applied or scheduled": [409, "Apple has already applied or scheduled this free week. Refresh to see its status."],
    "Referral offer awaiting Apple confirmation": [409, "Your week is reserved while Apple confirms it. Try again after the retry time shown."],
    "Referral offer already issued": [409, "This week is already being redeemed. Refresh and try again."],
    "Referral offer already applied": [409, "This week has already been used. Refresh to see your remaining weeks."],
  };
  const known = messages[message];
  if (known) return apiError(request, known[0], "referral_unavailable", known[1]);
  return handleApiError(request, error);
}
