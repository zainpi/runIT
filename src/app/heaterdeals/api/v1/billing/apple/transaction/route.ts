import {
  apiError,
  apiJson,
  checkBodySize,
  enforceRateLimit,
  getAdminClient,
  handleApiError,
  requireSession,
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
    const productID = process.env.HEATERDEALS_PRODUCT_ID ?? "com.heaterdeals.subscription.monthly";
    const bundleID = process.env.HEATERDEALS_BUNDLE_ID ?? "com.heaterdeals.app";
    if (
      transaction.bundleId !== bundleID ||
      transaction.productId !== productID ||
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
    const upsert = await admin
      .from("heater_entitlements")
      .upsert({
        account_id: session.sub,
        product_id: productID,
        original_transaction_id: transaction.originalTransactionId,
        transaction_id: transaction.transactionId,
        app_account_token: transaction.appAccountToken,
        environment: transaction.environment === "Sandbox" ? "Sandbox" : "Production",
        status,
        expires_at: transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
        revoked_at: transaction.revocationDate ? new Date(transaction.revocationDate).toISOString() : null,
        last_verified_at: new Date().toISOString(),
        raw: transaction,
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id,product_id" })
      .select("product_id, status, expires_at, environment")
      .single();
    if (upsert.error) throw upsert.error;
    return apiJson(request, { ok: true, active: status === "active" || status === "grace_period", data: upsert.data });
  } catch (error) {
    if (error instanceof Error && /verification|signed|certificate|Apple/i.test(error.message)) {
      return apiError(request, 400, "invalid_transaction", "The App Store transaction could not be verified.");
    }
    return handleApiError(request, error);
  }
}
