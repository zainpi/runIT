import {
  apiError,
  apiJson,
  checkBodySize,
  getAdminClient,
  handleApiError,
  isSupportedAppleProduct,
  syncDiscordAccess,
} from "@/lib/heaterdeals/server";
import { entitlementStatus, verifyNotification, verifyTransaction } from "@/lib/heaterdeals/apple";

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
    if (!(await isSupportedAppleProduct(admin, transaction.productId)) || !transaction.originalTransactionId) {
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
    const upsert = await admin.rpc("record_heater_apple_entitlement", {
      p_account_id: accountID, p_transaction: transaction, p_status: status,
    });
    if (upsert.error) throw upsert.error;
    try {
      await syncDiscordAccess(admin, accountID);
    } catch (error) {
      // Do not make Apple retry a valid notification solely because Discord is
      // temporarily unavailable. The next notification/status check repairs it.
      console.error("Discord access reconciliation failed after Apple notification", error);
    }

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
