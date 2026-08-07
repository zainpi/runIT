import {
  apiError,
  apiJson,
  checkBodySize,
  getAdminClient,
  handleApiError,
  getProductID,
} from "@/lib/heaterdeals/server";
import { asEnvironment, entitlementStatus, verifyNotification, verifyTransaction } from "@/lib/heaterdeals/apple";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 96_000);
  if (tooLarge) return tooLarge;
  try {
    const body = (await request.json()) as { signedPayload?: string };
    if (!body.signedPayload) return apiError(request, 400, "invalid_notification", "signedPayload is required.");
    const notification = await verifyNotification(body.signedPayload);
    if (!notification.notificationUUID) return apiError(request, 400, "invalid_notification", "notificationUUID is required.");

    const admin = getAdminClient();
    const duplicate = await admin.from("heater_apple_notifications").select("notification_uuid").eq("notification_uuid", notification.notificationUUID).maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) return apiJson(request, { ok: true, duplicate: true });

    const signedTransactionInfo = notification.data?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      await admin.from("heater_apple_notifications").insert({
        notification_uuid: notification.notificationUUID,
        notification_type: notification.notificationType ?? null,
      });
      return apiJson(request, { ok: true, ignored: true });
    }

    const transaction = await verifyTransaction(signedTransactionInfo);
    if (transaction.productId !== getProductID() || !transaction.originalTransactionId) {
      return apiJson(request, { ok: true, ignored: true });
    }

    let accountID: string | null = null;
    if (transaction.appAccountToken) {
      const account = await admin.from("heater_accounts").select("id").eq("app_account_token", transaction.appAccountToken).maybeSingle();
      if (account.error) throw account.error;
      accountID = account.data?.id ?? null;
    }
    if (!accountID) {
      const entitlement = await admin.from("heater_entitlements").select("account_id").eq("original_transaction_id", transaction.originalTransactionId).maybeSingle();
      if (entitlement.error) throw entitlement.error;
      accountID = entitlement.data?.account_id ?? null;
    }
    if (!accountID) {
      await admin.from("heater_apple_notifications").insert({
        notification_uuid: notification.notificationUUID,
        notification_type: notification.notificationType ?? null,
      });
      return apiJson(request, { ok: true, ignored: true });
    }

    const status = entitlementStatus(transaction, notification.notificationType);
    const upsert = await admin.from("heater_entitlements").upsert({
      account_id: accountID,
      product_id: getProductID(),
      original_transaction_id: transaction.originalTransactionId,
      transaction_id: transaction.transactionId ?? null,
      app_account_token: transaction.appAccountToken ?? null,
      environment: asEnvironment(transaction.environment),
      status,
      expires_at: transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
      revoked_at: transaction.revocationDate ? new Date(transaction.revocationDate).toISOString() : null,
      last_verified_at: new Date().toISOString(),
      raw: { notificationType: notification.notificationType, transaction },
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id,product_id" });
    if (upsert.error) throw upsert.error;

    const notificationInsert = await admin.from("heater_apple_notifications").insert({
      notification_uuid: notification.notificationUUID,
      notification_type: notification.notificationType ?? null,
    });
    if (notificationInsert.error && notificationInsert.error.code !== "23505") throw notificationInsert.error;
    return apiJson(request, { ok: true });
  } catch (error) {
    if (error instanceof Error && /verification|signed|certificate|Apple/i.test(error.message)) {
      return apiError(request, 400, "invalid_notification", "The Apple notification could not be verified.");
    }
    return handleApiError(request, error);
  }
}
