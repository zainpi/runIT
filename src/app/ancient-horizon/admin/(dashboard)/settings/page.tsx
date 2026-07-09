"use client";

import { useEffect, useState } from "react";
import { rpc } from "../../_lib/rpc";
import { Card, Btn, TextArea, Badge, ErrorNote, OkNote, Spinner } from "../../_components/ui";

type Status = { maintenance: boolean; maintenance_message: string };

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    rpc<Record<string, unknown>>("admin_get_stats")
      .then((s) => {
        const st = {
          maintenance: Boolean(s.maintenance),
          maintenance_message: String(s.maintenance_message ?? ""),
        };
        setStatus(st);
        setMessage(st.maintenance_message);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function setMaintenance(enabled: boolean) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await rpc<{ maintenance: boolean; message: string }>("admin_set_maintenance", {
        p_enabled: enabled,
        p_message: message.trim() || null,
      });
      setStatus({ maintenance: res.maintenance, maintenance_message: res.message });
      setOk(
        res.maintenance
          ? "Maintenance mode ENABLED — non-admin players are locked out at the database (RLS)."
          : "Maintenance mode disabled — game is live again."
      );
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="pixel text-2xl font-normal text-[#3a2410]">Settings</h1>
      <ErrorNote error={error} />
      <OkNote msg={ok} />

      <Card title="Maintenance mode">
        {!status ? (
          <Spinner />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[#4a3218]">
              Current status:
              {status.maintenance ? (
                <Badge tone="warn">MAINTENANCE — players locked out</Badge>
              ) : (
                <Badge tone="good">Live</Badge>
              )}
            </div>
            <p className="text-xs text-[#7a5c36]">
              Enforced by RLS in the database (008): during maintenance, non-admin sessions are
              denied gameplay data regardless of client. Admin accounts keep full access.
            </p>
            <TextArea
              rows={2}
              placeholder="Maintenance message shown to players…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {!status.maintenance ? (
              !confirming ? (
                <Btn kind="danger" onClick={() => setConfirming(true)}>Enable maintenance…</Btn>
              ) : (
                <div className="space-y-2 rounded-lg border border-[#d49a30] bg-[#d49a30]/15 p-3">
                  <div className="text-sm text-[#7a5410]">
                    This locks every non-admin player out of the game. Continue?
                  </div>
                  <div className="flex gap-2">
                    <Btn kind="danger" disabled={busy} onClick={() => setMaintenance(true)}>
                      {busy ? "Enabling…" : "Yes, enable maintenance"}
                    </Btn>
                    <Btn kind="ghost" onClick={() => setConfirming(false)}>Cancel</Btn>
                  </div>
                </div>
              )
            ) : (
              <Btn disabled={busy} onClick={() => setMaintenance(false)}>
                {busy ? "Disabling…" : "Disable maintenance (go live)"}
              </Btn>
            )}
          </div>
        )}
      </Card>

      <Card title="Security notes">
        <ul className="list-inside list-disc space-y-1 text-sm text-[#5a4226]">
          <li>This dashboard ships only the publishable key — no service key exists in the website.</li>
          <li>Every admin action re-checks <code className="text-[#4a3218]">is_admin()</code> inside the database; the UI gate is convenience only.</li>
          <li>Admins are managed in the <code className="text-[#4a3218]">admins</code> table (Supabase SQL editor, service role).</li>
          <li>Use a strong unique password + enable MFA on the Supabase account itself.</li>
        </ul>
      </Card>
    </div>
  );
}
