"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "./ui";

const TABS: { href: string; label: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/mail", label: "Mail & Rewards" },
  { href: "/admin/codes", label: "Codes" },
  { href: "/admin/chat", label: "Chat" },
  { href: "/admin/leaderboard", label: "Leaderboard" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default function Sidebar({
  email,
  maintenance,
}: {
  email: string;
  maintenance: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r border-white/10 bg-ink-900/80 px-3 py-5">
      <div className="px-2">
        <div className="text-sm font-semibold text-white">PROJECT_IDLE</div>
        <div className="text-xs text-slate-500">Admin dashboard</div>
        {maintenance && (
          <div className="mt-2">
            <Badge tone="warn">Maintenance ON</Badge>
          </div>
        )}
      </div>
      <nav className="mt-6 flex-1 space-y-1">
        {TABS.map((t) => {
          const active =
            t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand-600/20 font-medium text-brand-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-2 pt-3">
        <div className="truncate text-xs text-slate-500" title={email}>
          {email}
        </div>
        <button
          onClick={signOut}
          className="mt-2 text-xs text-slate-400 hover:text-red-400"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
