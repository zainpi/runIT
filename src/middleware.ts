import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const legalPages = {
  "/heaterdeals": "/heaterdeals/index.html",
  "/heaterdeals/": "/heaterdeals/index.html",
  "/heaterdeals/privacy": "/heaterdeals/privacy.html",
  "/heaterdeals/privacy/": "/heaterdeals/privacy.html",
  "/heaterdeals/terms": "/heaterdeals/terms.html",
  "/heaterdeals/terms/": "/heaterdeals/terms.html",
  "/heaterdeals/support": "/heaterdeals/support.html",
  "/heaterdeals/support/": "/heaterdeals/support.html",
} as const;

export async function middleware(request: NextRequest) {
  const legalPage = legalPages[request.nextUrl.pathname as keyof typeof legalPages];

  if (legalPage) {
    return NextResponse.rewrite(new URL(legalPage, request.url));
  }

  return updateSession(request);
}

export const config = {
  // Only the admin area needs sessions — keep the public site cookie-free.
  // Keep the HeaterDeals API out of the Supabase browser-session middleware; it
  // authenticates with its own short-lived signed session instead.
  matcher: [
    "/the-last-echo/admin/:path*",
    "/heaterdeals",
    "/heaterdeals/",
    "/heaterdeals/privacy",
    "/heaterdeals/privacy/",
    "/heaterdeals/terms",
    "/heaterdeals/terms/",
    "/heaterdeals/support",
    "/heaterdeals/support/",
  ],
};
