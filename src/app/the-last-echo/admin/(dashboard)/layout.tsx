import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "../_components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/the-last-echo/admin/login");

  // Server-side admin check (the DB re-checks on every RPC regardless).
  const { data: status } = await supabase.rpc("get_app_status");
  if (!status?.is_admin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-sm rounded-2xl border-4 border-[#5a3a1c] bg-gradient-to-b from-[#f3e7c9] to-[#e8d3a8] p-8 text-center shadow-[inset_0_0_0_2px_#c9a059,0_10px_0_rgba(40,22,8,.22)]">
          <h1 className="pixel text-2xl text-[#3a2410]">Not authorized</h1>
          <p className="mt-2 text-sm text-[#5a4226]">
            {user.email ?? user.id} is signed in but is not on the admin allowlist.
          </p>
          <a
            href="/the-last-echo/admin/login"
            className="pixel mt-4 inline-block text-lg text-[#3f7a24] underline"
          >
            Use a different account
          </a>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        email={user.email ?? user.id.slice(0, 8)}
        maintenance={Boolean(status?.maintenance)}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
