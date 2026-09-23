"use client";
import { useEffect, useRef, useState } from "react";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { validTrialId } from "@/lib/templates/trial-contract";
import type { Personalization } from "@/lib/templates/compose";
import styles from "./templates.module.css";
import trialStyles from "./trial/trial.module.css";

export function TrialCode({ selected, details, onActiveChange }: { selected: TemplateId[]; details: Personalization; onActiveChange: (active: boolean) => void }) {
  const [code, setCode] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId | "">("");
  const [consent, setConsent] = useState(false);
  const [savedUrl, setSavedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  useEffect(() => { setTemplateId(selected.length === 1 ? selected[0] : ""); }, [selected]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("runit-template-trial") || "null");
      if (validTrialId(saved?.sessionId) && /^[a-f0-9]{64}$/.test(saved?.accessToken)) setSavedUrl(`/templates/trial/#session_id=${saved.sessionId}&access=${saved.accessToken}`);
    } catch { /* The code form works without a saved trial. */ }
  }, []);
  async function redeem() {
    if (sending.current) return;
    if (!templateId || !details.idea.trim() || !consent || !code.trim()) { setError("Choose a template, describe your idea, and allow AI to prepare your overview."); return; }
    sending.current = true; setBusy(true); setError("");
    try {
      const normalized = code.trim().toUpperCase();
      const pending = JSON.parse(sessionStorage.getItem("runit-template-trial-pending") || "null");
      const accessToken = pending?.code === normalized && pending?.templateId === templateId && /^[a-f0-9]{64}$/.test(pending.token) ? pending.token : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      // Save before redeeming so a retry after a lost response cannot spend a second use.
      sessionStorage.setItem("runit-template-trial-pending", JSON.stringify({ code: normalized, templateId, token: accessToken }));
      const response = await fetch("/api/templates/trial/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", code: normalized, templateId, accessToken, brief: details, consent }) });
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
  return <form id="free-trial" className={trialStyles.form} aria-label="Free trial checkout" onSubmit={(event) => { event.preventDefault(); void redeem(); }}>
    <label htmlFor="trial-code">Free-trial code <span>optional</span></label>
    <input id="trial-code" aria-label="Free-trial code" value={code} onChange={(event) => { setCode(event.target.value); onActiveChange(!!event.target.value.trim()); setError(""); }} maxLength={100} placeholder="Enter your code" autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} required />
    {code.trim() && <div className={trialStyles.details}>
      <label>1. Choose your template<select required value={templateId} disabled={busy} onChange={(event) => setTemplateId(event.target.value as TemplateId)}><option value="">Select a template</option>{templateCatalog.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>
      <div className={trialStyles.brief}><div><strong>2. Your idea</strong><a href="#template-idea" onClick={() => document.getElementById("template-idea")?.focus()}>{details.idea.trim() ? "Edit" : "Add description →"}</a></div>
        {details.idea.trim() ? <p>{details.idea}</p> : <p>Describe what you want to make in step 02 before checking out.</p>}
      </div>
      <div className={trialStyles.included}><strong>Included in your free trial</strong><span>Personalized overview & feature plan</span><span>3 AI editing messages · Private dashboard</span><small>Full build templates and add-ons are sold separately.</small></div>
      <div className={styles.total}><span>Due today</span><strong>$0.00</strong></div>
      <label className={trialStyles.consent}><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /><span>Use OpenAI to prepare my overview and refine my plan. My brief and chats will be saved to my private link.</span></label>
      <button className={styles.primary} disabled={busy || !templateId || !details.idea.trim() || !consent} type="submit">{busy ? "Creating your dashboard…" : "Complete free checkout →"}</button>
      <p className={styles.small}>No card required. Your overview starts after checkout.</p>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {savedUrl && <a className={styles.small} href={savedUrl}>Return to my saved trial →</a>}
  </form>;
}
