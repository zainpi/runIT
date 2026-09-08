import {
  cancelDiscordLink,
  completeDiscordLink,
  getAdminClient,
  getDiscordConfig,
} from "@/lib/heaterdeals/server";

export const runtime = "nodejs";

function redirectToApp(status: "success" | "cancelled" | "error", state: string | null, errorCode?: string) {
  const appCallback = process.env.HEATERDEALS_DISCORD_APP_CALLBACK ?? "pulsedeals://discord/callback";
  const callbackURL = new URL(appCallback);
  callbackURL.searchParams.set("status", status);
  if (state) callbackURL.searchParams.set("state", state);
  if (errorCode) callbackURL.searchParams.set("error", errorCode);
  return new Response(null, {
    status: 302,
    headers: {
      location: callbackURL.toString(),
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    if (state) {
      try {
        await cancelDiscordLink(getAdminClient(), state);
      } catch (error) {
        console.error("Discord OAuth cancellation could not be recorded", error);
      }
    }
    return redirectToApp("cancelled", state, "access_denied");
  }

  const code = url.searchParams.get("code");
  if (!state || !code) return redirectToApp("error", state, "invalid_callback");

  try {
    // Validate server configuration before consuming the one-time state.
    getDiscordConfig();
    await completeDiscordLink(getAdminClient(), state, code);
    return redirectToApp("success", state);
  } catch (error) {
    console.error("Discord link callback failed", error);
    const errorCode = error instanceof Error && error.message === "Active subscription required"
      ? "subscription_required"
      : "link_failed";
    return redirectToApp("error", state, errorCode);
  }
}
