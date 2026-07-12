import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Refreshes the Supabase session cookie and gates /admin:
 * unauthenticated requests to /admin/* are redirected to /admin/login.
 * (The real authorization boundary is in the database — every admin_* RPC
 * checks is_admin() server-side. This is UX, not the security boundary.)
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminArea = path.startsWith("/the-last-echo/admin");
  const isLoginPage = path === "/the-last-echo/admin/login";

  if (isAdminArea && !isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/the-last-echo/admin/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
