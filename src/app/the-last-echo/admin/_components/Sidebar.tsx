"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "./ui";

const BASE = "/the-last-echo/admin";

const TABS: { href: string; label: string }[] = [
  { href: BASE, label: "Overview" },
  { href: `${BASE}/players`, label: "Players" },
  { href: `${BASE}/mail`, label: "Mail & Rewards" },
  { href: `${BASE}/codes`, label: "Codes" },
  { href: `${BASE}/chat`, label: "Chat" },
  { href: `${BASE}/leaderboard`, label: "Leaderboard" },
  { href: `${BASE}/reports`, label: "Reports" },
  { href: `${BASE}/settings`, label: "Settings" },
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
    router.replace(`${BASE}/login`);
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r-4 border-[#3f2812] bg-gradient-to-b from-[#8a5a2b] to-[#6b4423] px-3 py-5 shadow-[inset_0_2px_0_#a87b4c]">
      <div className="flex items-center gap-2.5 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/the-last-echo/img/icon.svg"
          alt=""
          width={34}
          height={34}
          className="rounded-lg border-2 border-[#3f2812] bg-[#bfe0f0]"
          style={{ imageRendering: "pixelated" }}
        />
        <div>
          <div className="pixel text-lg leading-tight !text-[#f3e7c9] [text-shadow:1px_1px_0_#2a1808]">
            The Last Echo
          </div>
          <div className="text-[11px] text-[#e0c88e]">Admin dashboard</div>
        </div>
      </div>
      {maintenance && (
        <div className="mt-2 px-2">
          <Badge tone="warn">Maintenance ON</Badge>
        </div>
      )}
      <nav className="mt-5 flex-1 space-y-1.5">
        {TABS.map((t) => {
          const active = t.href === BASE ? pathname === BASE : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`pixel block rounded-lg border-2 px-3 py-1.5 text-lg transition ${
                active
                  ? "border-[#3f2812] bg-gradient-to-b from-[#fbf2dc] to-[#e8d3a8] !text-[#3a2410] shadow-[0_2px_0_#3f2812]"
                  : "border-transparent !text-[#f3e7c9] hover:border-[#3f2812]/60 hover:bg-[#3f2812]/30"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t-2 border-[#3f2812]/60 px-2 pt-3">
        <div className="truncate text-xs text-[#e0c88e]" title={email}>
          {email}
        </div>
        <button
          onClick={signOut}
          className="pixel mt-2 text-base !text-[#f3e7c9] underline decoration-[#c9a059] hover:!text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
