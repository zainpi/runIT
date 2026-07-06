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
  if (!user) redirect("/admin/login");

  // Server-side admin check (the DB re-checks on every RPC regardless).
  const { data: status } = await supabase.rpc("get_app_status");
  if (!status?.is_admin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-ink-800/70 p-8 text-center">
          <h1 className="text-lg font-semibold text-white">Not authorized</h1>
          <p className="mt-2 text-sm text-slate-400">
            {user.email ?? user.id} is signed in but is not on the admin allowlist.
          </p>
          <a href="/admin/login" className="mt-4 inline-block text-sm text-brand-300 hover:underline">
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
