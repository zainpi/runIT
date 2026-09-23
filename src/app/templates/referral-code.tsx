"use client";
import { useState } from "react";
import styles from "./templates.module.css";

export type AppliedReferral = { code: string; founder: string; discountPercent: number };

export function ReferralCode({ value, applied, disabled, onChange, onApplied }: {
  value: string;
  applied: AppliedReferral | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  onApplied: (value: AppliedReferral | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const normalized = value.trim().toUpperCase();
  const alreadyApplied = applied?.code === normalized;

  async function apply() {
    if (!normalized) {
      onApplied(null);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/templates/referral/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const result = await response.json() as { founder?: unknown; discountPercent?: unknown; error?: string };
      if (!response.ok || typeof result.founder !== "string" || typeof result.discountPercent !== "number") throw new Error(result.error || "That referral code is not valid.");
      onApplied({ code: normalized, founder: result.founder, discountPercent: result.discountPercent });
    } catch (cause) {
      onApplied(null);
      setError(cause instanceof Error ? cause.message : "The referral code could not be checked. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.referral}>
    <label htmlFor="template-referral-code">Discount code</label>
    <div className={styles.codeRow}>
      <input id="template-referral-code" aria-label="Discount code" value={value} disabled={disabled || busy} onChange={(event) => { onChange(event.target.value); setError(""); }} placeholder="Enter code" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      <button className={styles.secondary} type="button" disabled={disabled || busy || !normalized || alreadyApplied} onClick={() => void apply()}>{busy ? "Checking…" : alreadyApplied ? "Applied" : "Apply"}</button>
    </div>
    {applied && alreadyApplied && <p className={styles.referralSuccess} role="status">{applied.discountPercent}% off applied</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
