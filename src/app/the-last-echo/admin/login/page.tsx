"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Btn, Input, ErrorNote } from "../_components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    // The DB is the real gate — a non-admin session gets "not authorized"
    // from every admin RPC. This check just gives a clean early message.
    const { data } = await supabase.rpc("get_app_status");
    if (!data?.is_admin) {
      await supabase.auth.signOut();
      setError("This account is not an admin.");
      setBusy(false);
      return;
    }
    router.replace("/the-last-echo/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form
        onSubmit={signIn}
        className="w-full max-w-sm overflow-hidden rounded-2xl border-4 border-[#5a3a1c] bg-gradient-to-b from-[#f3e7c9] to-[#e8d3a8] shadow-[inset_0_0_0_2px_#c9a059,0_10px_0_rgba(40,22,8,.22),0_18px_34px_rgba(40,22,8,.3)]"
      >
        <div className="border-b-4 border-[#3f2812] bg-gradient-to-b from-[#8a5a2b] to-[#6b4423] px-6 py-5 text-center shadow-[inset_0_2px_0_#a87b4c]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/the-last-echo/img/icon.svg"
            alt=""
            width={46}
            height={46}
            className="mx-auto mb-2 rounded-lg border-2 border-[#3f2812] bg-[#bfe0f0]"
            style={{ imageRendering: "pixelated" }}
          />
          <h1 className="pixel text-3xl !text-[#f3e7c9] [text-shadow:2px_2px_0_#2a1808]">
            Admin Sign In
          </h1>
          <p className="mt-1 text-sm text-[#e8d3a8]">The Last Echo dashboard</p>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="pixel mb-1.5 block text-base text-[#5a3a1c]">Email</label>
            <Input
              type="email"
              required
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="pixel mb-1.5 block text-base text-[#5a3a1c]">Password</label>
            <Input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <ErrorNote error={error} />
          <div className="pt-1">
            <Btn type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </Btn>
          </div>
        </div>
      </form>
    </main>
  );
}
