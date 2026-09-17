"use client";
import { useEffect, useRef, useState } from "react";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { validTrialId } from "@/lib/templates/trial-contract";
import styles from "./templates.module.css";
import trialStyles from "./trial/trial.module.css";

export function TrialCode({ selected }: { selected: TemplateId[] }) {
  const [code, setCode] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("mobile-app");
  const [savedUrl, setSavedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  useEffect(() => { if (selected[0]) setTemplateId(selected[0]); }, [selected]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("runit-template-trial") || "null");
      if (validTrialId(saved?.sessionId) && /^[a-f0-9]{64}$/.test(saved?.accessToken)) setSavedUrl(`/templates/trial/#session_id=${saved.sessionId}&access=${saved.accessToken}`);
    } catch { /* The code form works without a saved trial. */ }
  }, []);
  async function redeem() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const normalized = code.trim().toUpperCase();
      const pending = JSON.parse(sessionStorage.getItem("runit-template-trial-pending") || "null");
      const accessToken = pending?.code === normalized && pending?.templateId === templateId && /^[a-f0-9]{64}$/.test(pending.token) ? pending.token : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      // Save before redeeming so a retry after a lost response cannot spend a second use.
      sessionStorage.setItem("runit-template-trial-pending", JSON.stringify({ code: normalized, templateId, token: accessToken }));
      const response = await fetch("/api/templates/trial/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", code: normalized, templateId, accessToken }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your trial could not be opened.");
      if (!validTrialId(result.sessionId)) throw new Error("The trial link could not be verified. Retry to recover it.");
      try { localStorage.setItem("runit-template-trial", JSON.stringify({ sessionId: result.sessionId, accessToken })); } catch { /* The fragment still carries access; save it on the next page. */ }
      window.location.assign(`/templates/trial/#session_id=${result.sessionId}&access=${accessToken}`);
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== "SecurityError" ? cause.message : "Allow browser storage so we can recover your trial if the connection drops.");
      sending.current = false; setBusy(false);
    }
  }
  return <form id="free-trial" className={trialStyles.form} aria-label="Redeem a free-trial code" onSubmit={(event) => { event.preventDefault(); void redeem(); }}>
    <label htmlFor="trial-code">Free-trial code <span>optional</span></label>
    <div className={trialStyles.codeRow}>
      <input id="trial-code" aria-label="Free-trial code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={100} placeholder="Enter your code" autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} required />
      <button className={styles.secondary} aria-label="Redeem free trial" disabled={busy || !code.trim()} type="submit">{busy ? "Opening…" : "Redeem"}</button>
    </div>
    {code.trim() && <div className={trialStyles.details}>
      {selected.length !== 1 && <label>Template to try<select value={templateId} disabled={busy} onChange={(event) => setTemplateId(event.target.value as TemplateId)}>{templateCatalog.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>}
      <p className={styles.small}>Try {templateCatalog.find((template) => template.id === templateId)?.title}: one AI overview + 3 messages. Full templates require a purchase.</p>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {savedUrl && <a className={styles.small} href={savedUrl}>Return to my saved trial →</a>}
  </form>;
}
