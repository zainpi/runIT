"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { templateCatalog, type BuildMode, type TemplateId } from "@/lib/templates/catalog";
import { emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { validTrialId, type TrialAccess } from "@/lib/templates/trial-contract";
import { downloadText, loadDraft, saveDraft } from "../browser-storage";
import { AiEditor } from "../library/ai-editor";
import { Personalize } from "../personalize";
import styles from "../templates.module.css";

export function TemplateTrial() {
  const [access, setAccess] = useState<TrialAccess | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId | null>(null);
  const [details, setDetails] = useState<Personalization>(emptyPersonalization);
  const [mode, setMode] = useState<BuildMode>("manual");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let generation = 0;
    const draft = loadDraft(); setDetails(draft.details); setMode(draft.mode);
    async function open() {
      const current = ++generation;
      setAccess(null); setTemplateId(null); setError(""); setLoading(true);
      const hash = new URLSearchParams(location.hash.slice(1));
      const sessionId = hash.get("session_id"), accessToken = hash.get("access");
      if (!validTrialId(sessionId) || !accessToken || !/^[a-f0-9]{64}$/.test(accessToken)) { setError("Open your full private trial link, or redeem a code on the templates page."); setLoading(false); return; }
      try {
        const response = await fetch("/api/templates/trial/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", sessionId, accessToken }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (generation !== current) return;
        if (!templateCatalog.some((t) => t.id === result.templateId)) throw new Error("This trial template is unavailable.");
        setTemplateId(result.templateId); setAccess({ sessionId, accessToken }); setUrl(location.href);
        try { localStorage.setItem("runit-template-trial", JSON.stringify({ sessionId, accessToken })); } catch { /* Save-link controls are still available. */ }
      } catch (cause) { if (generation === current) setError(cause instanceof Error ? cause.message : "Your trial could not be loaded."); }
      finally { if (generation === current) setLoading(false); }
    }
    void open(); window.addEventListener("hashchange", open);
    return () => { generation++; window.removeEventListener("hashchange", open); };
  }, []);
  function updateDetails(brief: Personalization) {
    setDetails(brief);
    try { const draft = loadDraft(); saveDraft(brief, mode, templateId ? [templateId] : draft.selected, draft.subagents, draft.skillTree); } catch { /* Editing works without persistence. */ }
  }
  return <>
    <section className={styles.libraryHero}><p className={styles.eyebrow}>Your free trial</p><h1>Try your <em>idea.</em></h1><p className={styles.muted}>One AI overview and 3 editing messages for {templateCatalog.find((t) => t.id === templateId)?.title.toLowerCase() || "your chosen template"}. No payment required.</p></section>
    {loading && <p role="status">Opening your trial…</p>}
    {error && <p role="alert" className={styles.notice}>{error} <Link href="/templates/#free-trial">Enter a trial code →</Link></p>}
    {access && templateId && <>
      <section className={styles.accessBar}><h2>Save your private trial link</h2><p className={styles.small}>Return to your plan and chat on any device. Anyone with this link can use your trial allowance.</p><label htmlFor="trial-url">Your private trial URL</label><input id="trial-url" className={styles.purchaseUrl} readOnly value={url} onFocus={(event) => event.currentTarget.select()} /><div className={styles.actions}><button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(url); setStatus("Trial link copied."); } catch { setStatus("Select the link to copy it, or download the access file."); } }}>Copy trial link</button><button className={styles.secondary} onClick={() => downloadText(`YOUR PRIVATE TRIAL LINK\n\n${url}\n\nKeep this link private. It opens your saved AI plan and chat.`, "template-trial-access.txt")}>Download trial access file</button></div><p role="status">{status}</p></section>
      <section className={styles.workshop}><Personalize details={details} mode={mode} onDetails={updateDetails} onMode={setMode} previewOnly previewPurchaseHref="/templates/#bundle" /></section>
      <AiEditor key={`${access.sessionId}:${access.accessToken}`} receipt={access} templateId={templateId} details={details} trial onRestoreBrief={updateDetails} onApplied={() => {}} onCleared={() => {}} />
      <section className={styles.accessBar}><h2>Ready for the full build prompt?</h2><p className={styles.muted}>Purchase your foundation to get its full prompt, a free overview and 20 editing messages. Download your trial plan to keep your decisions. The trial and purchase have separate conversations.</p><Link className={styles.primary} href="/templates/#bundle">Choose my template →</Link></section>
    </>}
    <p className={styles.libraryBack}><Link href="/templates/">← Back to all templates</Link></p>
  </>;
}
