import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only the admin area needs sessions — keep the public site cookie-free.
  matcher: ["/admin/:path*"],
};
