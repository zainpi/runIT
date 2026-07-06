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
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form
        onSubmit={signIn}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-ink-800/70 p-6 sm:p-8"
      >
        <div>
          <h1 className="text-xl font-semibold text-white">Admin sign in</h1>
          <p className="mt-1 text-sm text-slate-400">PROJECT_IDLE dashboard</p>
        </div>
        <Input
          type="email"
          required
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorNote error={error} />
        <Btn type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Btn>
      </form>
    </main>
  );
}
