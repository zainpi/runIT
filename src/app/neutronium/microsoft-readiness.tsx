"use client";
import { useState } from "react";
import { Workspace, fullName } from "@/lib/neutronium/model";
type Run = (path: string, data: unknown, success?: string) => Promise<unknown>;
export function MicrosoftReadiness({ w, run }: { w: Workspace; run: Run }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(path: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      await run(path, data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="nt-tool-card">
      <h2>Company email and access readiness</h2>
      <p>
        Microsoft hosts company mailboxes. Invitations and reminders use
        Neutronium’s separate email service.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="nt-button"
        disabled={busy || w.demo}
        onClick={() => void act("microsoft/readiness", {})}
      >
        Check domains and licenses
      </button>{" "}
      <button
        className="nt-button"
        disabled={busy || w.demo}
        onClick={() => void act("microsoft/reconcile", {})}
      >
        Reconcile configured access
      </button>
      <p>
        Readiness last checked:{" "}
        {w.microsoftReadiness?.checkedAt
          ? new Date(w.microsoftReadiness.checkedAt).toLocaleString()
          : "Not checked"}
      </p>
      {w.microsoftReadiness?.domains.map((d) => (
        <details key={d.id}>
          <summary>
            {d.id} ·{" "}
            {d.isVerified ? "Verified domain" : "Verification required"}
          </summary>
          <p>
            Microsoft-reported service records. Review with your DNS
            administrator before changing anything.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(w.microsoftReadiness?.dns?.[d.id] || [], null, 2)}
          </pre>
          <p>
            Retrieve DKIM targets from Exchange Online and enable signing there.
            Preserve other authorized SPF senders. MX cutover and DMARC policy
            changes require a separate change plan.
          </p>
        </details>
      ))}
      {w.microsoftReadiness?.skus.map((s) => (
        <p key={s.id}>
          {s.name} · {s.available} seats available ·{" "}
          {s.exchange
            ? "Includes Exchange plan"
            : "No active Exchange plan detected"}
          <br />
          <small>SKU: {s.id}</small>
        </p>
      ))}
      <h3>Mailbox readiness</h3>
      <p>
        Identity creation or license assignment does not prove that a mailbox is
        ready.
      </p>
      {w.employees
        .filter((e) => e.providerId)
        .map((e) => (
          <details key={e.id}>
            <summary>
              {fullName(e)} ·{" "}
              {e.mailbox?.status === "manually_verified"
                ? "Manually verified"
                : e.mailbox?.status === "pending"
                  ? "Provisioning pending"
                  : "Readiness unknown"}
            </summary>
            {e.mailbox?.evidence && (
              <p>
                {e.mailbox.evidence.method}: {e.mailbox.evidence.note}
              </p>
            )}
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                void act("mailbox/verify", {
                  ...Object.fromEntries(new FormData(ev.currentTarget)),
                  employeeId: e.id,
                });
              }}
            >
              <label>
                Verification method
                <input
                  name="method"
                  placeholder="Mailbox checked in Exchange admin center"
                  required
                />
              </label>
              <label>
                Evidence
                <textarea
                  name="note"
                  placeholder="Record the readiness check without copying mailbox content."
                  required
                />
              </label>
              <button className="nt-button" disabled={busy}>
                Record manual verification
              </button>
            </form>
          </details>
        ))}
      <h3>Access reconciliation</h3>
      <p>
        Configured Microsoft groups and matched employees only. Unknown
        directory accounts and other applications are outside this coverage.
      </p>
      <p>
        Status: {w.reconciliation?.status || "Not checked"} · Last complete
        check: {w.reconciliation?.succeededAt || "Never"} ·{" "}
        {w.reconciliation?.coverage || 0} groups checked
      </p>
      {w.reconciliation?.error && (
        <p role="alert">
          {w.reconciliation.error} Previous findings are retained.
        </p>
      )}
      {w.reconciliation?.findings.map((f, i) => (
        <p key={i}>
          {fullName(w.employees.find((e) => e.id === f.employeeId))} ·{" "}
          {w.applications.find((a) => a.id === f.applicationId)?.name} ·{" "}
          {f.type} access
        </p>
      ))}
    </section>
  );
}
