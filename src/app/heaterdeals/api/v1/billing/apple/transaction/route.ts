import {
  apiError,
  apiJson,
  checkBodySize,
  enforceRateLimit,
  getAdminClient,
  handleApiError,
  requireSession,
  syncDiscordAccess,
  isSupportedAppleProduct,
  getMembership,
} from "@/lib/heaterdeals/server";
import { entitlementStatus, verifyTransaction } from "@/lib/heaterdeals/apple";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 48_000);
  if (tooLarge) return tooLarge;
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `billing:${session.sub}`, 12, 3_600);
    if (limit) return limit;
    const body = (await request.json()) as { signedTransaction?: string };
    if (!body.signedTransaction) return apiError(request, 400, "invalid_request", "signedTransaction is required.");

    const transaction = await verifyTransaction(body.signedTransaction);
    const bundleID = process.env.HEATERDEALS_BUNDLE_ID ?? "com.pulsedeals.app";
    if (
      transaction.bundleId !== bundleID ||
      !(await isSupportedAppleProduct(admin, transaction.productId)) ||
      !transaction.originalTransactionId ||
      !transaction.transactionId ||
      !transaction.appAccountToken
    ) {
      return apiError(request, 400, "invalid_transaction", "The App Store transaction is not for this account.");
    }

    const account = await admin
      .from("heater_accounts")
      .select("id, app_account_token")
      .eq("id", session.sub)
      .single();
    if (account.error) throw account.error;
    if (account.data.app_account_token.toLowerCase() !== transaction.appAccountToken.toLowerCase()) {
      return apiError(request, 403, "transaction_account_mismatch", "The transaction is linked to another app account.");
    }

    const existing = await admin
      .from("heater_entitlements")
      .select("account_id")
      .eq("original_transaction_id", transaction.originalTransactionId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && existing.data.account_id !== session.sub) {
      return apiError(request, 409, "transaction_already_linked", "This App Store transaction is already linked.");
    }

    const status = entitlementStatus(transaction);
    const upsert = await admin.rpc("record_heater_apple_entitlement", {
      p_account_id: session.sub, p_transaction: transaction, p_status: status,
    });
    if (upsert.error) throw upsert.error;
    try {
      await syncDiscordAccess(admin, session.sub);
    } catch (error) {
      // Billing must remain successful even if Discord is temporarily down;
      // the next status read or Apple notification will reconcile the role.
      console.error("Discord access reconciliation failed after purchase", error);
    }
    const membership = await getMembership(admin, session.sub);
    return apiJson(request, { ok: true, active: membership.tier !== "none", data: membership });
  } catch (error) {
    if (error instanceof Error && /verification|signed|certificate|Apple/i.test(error.message)) {
      return apiError(request, 400, "invalid_transaction", "The App Store transaction could not be verified.");
    }
    return handleApiError(request, error);
  }
}
