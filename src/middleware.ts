import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { renamedPulseDealsPath } from "@/lib/pulsedeals/compatibility";

const legalPages = {
  "/pulsedeals": "/pulsedeals/index.html",
  "/pulsedeals/": "/pulsedeals/index.html",
  "/pulsedeals/privacy": "/pulsedeals/privacy.html",
  "/pulsedeals/privacy/": "/pulsedeals/privacy.html",
  "/pulsedeals/terms": "/pulsedeals/terms.html",
  "/pulsedeals/terms/": "/pulsedeals/terms.html",
  "/pulsedeals/support": "/pulsedeals/support.html",
  "/pulsedeals/support/": "/pulsedeals/support.html",
} as const;

export async function middleware(request: NextRequest) {
  const renamedPath = renamedPulseDealsPath(request.nextUrl.pathname);
  if (renamedPath) {
    const url = request.nextUrl.clone();
    url.pathname = renamedPath;
    // Keep API methods, credentials, request bodies, and OAuth query parameters.
    // Old public bookmarks can move permanently to the new product URL.
    return renamedPath.startsWith("/pulsedeals/api/")
      ? NextResponse.rewrite(url)
      : NextResponse.redirect(url, 308);
  }

  const legalPage = legalPages[request.nextUrl.pathname as keyof typeof legalPages];

  if (legalPage) {
    return NextResponse.rewrite(new URL(legalPage, request.url));
  }

  if (request.nextUrl.pathname.startsWith("/pulsedeals/")) return NextResponse.next();

  return updateSession(request);
}

export const config = {
  // Only the admin area needs sessions — keep the public site cookie-free.
  // PulseDeals API requests bypass browser sessions and authenticate themselves.
  matcher: [
    "/the-last-echo/admin/:path*",
    "/pulsedeals/:path*",
    "/heaterdeals/:path*",
  ],
};
