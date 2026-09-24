"use client";
import { useEffect, useRef, useState } from "react";
import { TRIAL_MESSAGE_LIMIT } from "@/lib/templates/trial-contract";
import { sameBrief, type AppPlan, type AiProject, type AiSnapshot } from "@/lib/templates/ai-contract";
import type { TemplateId } from "@/lib/templates/catalog";
import type { Personalization } from "@/lib/templates/compose";
import { planTechnicalDetails } from "@/lib/templates/technical-details";
import { downloadText, type Receipt } from "../browser-storage";
import styles from "./ai-editor.module.css";
import shared from "../templates.module.css";

type Props = {
  receipt: Pick<Receipt, "sessionId" | "accessToken">; trial?: boolean; templateId: TemplateId; details: Personalization;
  onApplied(plan: AppPlan | null, brief: Personalization | null): void;
  onRestoreBrief(brief: Personalization): void;
  onCleared(): void;
  onProject?(project: AiProject | null): void;
};
export function AiEditor({ receipt, templateId, details, onApplied, onRestoreBrief, onCleared, onProject, trial = false }: Props) {
  const [state, setState] = useState<AiSnapshot | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const alive = useRef(false);
  const callbacks = useRef({ onApplied, onRestoreBrief, onCleared, onProject });
  callbacks.current = { onApplied, onRestoreBrief, onCleared, onProject };
  const pending = useRef<{ requestId: string; fingerprint: string } | null>(null);
  const sending = useRef(false);
  const latestDetails = useRef(details);
  latestDetails.current = details;
  const allowance = trial ? TRIAL_MESSAGE_LIMIT : 20;
  const accessLabel = trial ? "trial" : "purchase";
  const project = state?.projects[templateId];
  const freeOverview = !state?.overviewUsed.includes(templateId);
  const stale = !!project && !sameBrief(project.brief, details);

  async function request(data: Record<string, unknown>) {
    const response = await fetch("/api/templates/ai/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: receipt.sessionId, accessToken: receipt.accessToken, templateId, ...data }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The conversation could not be loaded.");
    return result as { available: boolean; state: AiSnapshot | null };
  }
  function accept(result: { available: boolean; state: AiSnapshot | null }) {
    setAvailable(result.available); setState(result.state);
    const saved = result.state?.projects[templateId];
    callbacks.current.onApplied(saved?.appliedPlan ?? null, saved?.appliedBrief ?? null);
    callbacks.current.onProject?.(saved ?? null);
  }
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const initialDetails = latestDetails.current;
    // Loading history never spends an AI message or sends a brief to OpenAI.
    request({ action: "load" }).then((result) => {
      if (cancelled) return;
      accept(result);
      const saved = result.state?.projects[templateId];
      if (saved && sameBrief(initialDetails, latestDetails.current)) callbacks.current.onRestoreBrief(saved.brief);
    }).catch(() => { if (!cancelled) setError(trial ? "AI editing could not be loaded. Keep your trial link and refresh to try again." : "AI editing could not be loaded. Your template is still available below."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; alive.current = false; };
    // The parent keys this component by purchase credential and template.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state?.pending) return;
    let cancelled = false;
    const timer = setTimeout(() => { request({ action: "load" }).then((result) => { if (!cancelled) accept(result); }).catch(() => { if (!cancelled) setError("Status could not refresh. Use Refresh conversation or reopen your saved link; the job can continue in the background."); }); }, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
    // Each pending snapshot schedules one poll; failed polls require a manual retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function act(action: "overview" | "message" | "guide" | "apply" | "load" | "clear") {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    const generate = action === "overview" || action === "message" || action === "guide";
    const body = { action, revision: project?.revision ?? 0, ...(generate ? { brief: details, message, consent } : {}) };
    const fingerprint = JSON.stringify(body);
    if (generate && pending.current?.fingerprint !== fingerprint) pending.current = { requestId: crypto.randomUUID(), fingerprint };
    try {
      const result = await request({ ...body, ...(generate ? { requestId: pending.current?.requestId } : {}) });
      if (!alive.current) return;
      accept(result); pending.current = null;
      if (generate && action !== "guide") { setMessage(""); setNotice(trial ? "Your plan is ready to review. Send a message to refine it, or download a copy." : "Your plan is ready to review. Apply it when you’re happy with it."); }
      if (action === "guide") setNotice("Guide requested. It is saved to this purchase when ready; you can safely return using your private link.");
      if (action === "apply") setNotice("Applied to your full prompt below and saved to this purchase.");
      if (action === "clear") { callbacks.current.onCleared(); setConfirmClear(false); setNotice(`Saved AI briefs, plans, messages and guides deleted from this ${accessLabel}. Your remaining allowance is unchanged.`); }
    } catch (cause) {
      if (!alive.current) return;
      setError(cause instanceof Error ? cause.message : "Please refresh the conversation before retrying.");
      // Reconcile before allowing a new send: a response may have committed despite a lost connection.
      try {
        const result = await request({ action: "load" });
        if (alive.current) {
          accept(result);
          const recovered = result.state?.projects[templateId];
          if (generate && action !== "guide" && recovered && recovered.revision > body.revision && sameBrief(recovered.brief, details) && (action === "overview" || recovered.history.some((entry, index) => index === recovered.history.length - 2 && entry.role === "user" && entry.text === message.trim()))) {
            setMessage(""); setError(""); setNotice("Your response was saved. Review the updated plan below.");
          }
          pending.current = null;
        }
      } catch { /* Keep the request ID for a safe retry. */ }
    } finally { sending.current = false; if (alive.current) { setBusy(false); setLoading(false); } }
  }
  const locked = loading || busy || !!state?.pending;
  const exportText = (value: AiProject) => JSON.stringify({ brief: value.brief, plan: value.plan, history: value.history }, null, 2);
  return <section className={styles.editor} aria-labelledby="ai-editor-heading" aria-busy={busy || loading}>
    <div className={styles.heading}><div><p className={shared.eyebrow}>{trial ? "Included in your free trial" : "Included with your purchase"}</p><h2 id="ai-editor-heading">Shape your app with AI</h2></div><span className={styles.allowance}>{state ? `${state.remaining} of ${state.limit} messages left` : `${allowance} messages per ${accessLabel}`}</span></div>
    <p className={shared.muted}>{trial ? "Try a free overview and feature list, then refine your idea with 3 editing messages. Full build prompts and add-ons are available with a purchase. This chat only edits your app plan." : "Start with a free overview and feature list, then tell the AI what to change. Your 20 messages are shared across the templates in this purchase; the first overview for each template is free. Review your plan, then create its complete build guide below."}</p>
    {loading && <p role="status">Opening your saved conversation…</p>}
    {!loading && !available && <p className={shared.notice}>{trial ? "AI editing is currently unavailable. Your saved plan and chat are still accessible." : "AI editing is currently unavailable. You can still edit your brief and copy or download the template below."}</p>}
    {project && <>
      <div className={styles.overview}><h3>Based on your brief, your app would aim for:</h3><p>{project.plan.overview}</p>
        <table><caption className={styles.caption}>Features for {project.brief.name || "your app"}</caption><thead><tr><th scope="col">Part</th><th scope="col">What {project.brief.name || "your app"} would do</th></tr></thead><tbody>{project.plan.features.map((feature, index) => <tr key={index}><th scope="row">{feature.part}</th><td>{feature.description}</td></tr>)}</tbody></table>
        <div><h4>Technical details</h4><p>{project.plan.technicalDetails?.length ? "Proposed implementation notes. Validate choices before building." : "Starting points based on this template. Review them against your final feature scope."}</p><ul>{planTechnicalDetails(project.plan, templateId).notes.map((value, index) => <li key={index}>{value}</li>)}</ul></div>
        {!!project.plan.questions.length && <div><h4>Decisions to make</h4><ul>{project.plan.questions.map((value, index) => <li key={index}>{value}</li>)}</ul></div>}
        <p className={shared.small}>This is a proposed specification. It does not mean the app or integrations have been built.</p>
      </div>
      {stale && <p className={shared.notice}>Your brief differs from this saved overview. Send a message to update the plan, or <button className={styles.textButton} disabled={locked} onClick={() => callbacks.current.onRestoreBrief(project.brief)}>restore the saved brief</button>.</p>}
      <div className={styles.actions}>{!trial && <button className={shared.primary} disabled={locked || stale || project.appliedRevision === project.revision} onClick={() => void act("apply")}>{stale ? "Update the plan for your new brief" : project.appliedRevision === project.revision ? "Applied to your prompt" : "Apply plan to my prompt"}</button>}<button className={shared.secondary} onClick={() => downloadText(exportText(project), `${templateId}-ai-plan.json`)}>Download plan & chat</button></div>
      <details className={styles.history} open><summary>Conversation</summary><ol>{project.history.map((entry, index) => <li key={index} data-role={entry.role}><strong>{entry.role === "user" ? "You" : "AI"}</strong><p>{entry.text}</p></li>)}</ol></details>
    </>}
    {!trial && project && <div className={styles.overview}><h3>Turn this plan into your complete build guide</h3><p>Get step-by-step setup, service links, database and permission rules, feature specifications, tests, launch and maintenance instructions, plus an HTML prototype. Review the plan above first.</p><p className={shared.small}>Your first successful guide for each purchased template is included. Regenerating uses one of your 20 editing messages. Failed attempts do not use a message. Generation can take a few minutes.</p><button className={shared.primary} disabled={locked || !available || !consent || stale || (!!state?.guideUsed?.includes(templateId) && state.remaining === 0)} onClick={() => void act("guide")}>{state?.guideUsed?.includes(templateId) ? "Regenerate build guide · 1 message" : "Create my complete build guide"}</button>{!consent && <p className={shared.small}>Check the OpenAI consent box below to create your guide.</p>}</div>}
    {state?.guideError && <p role="alert" className={shared.notice}>{state.guideError}</p>}
    {state?.pending && <p role="status">{state.pendingKind === "guide" ? "Your complete guide is being prepared. This page checks automatically. You can leave and reopen your private purchase link." : `A response is being prepared for this ${accessLabel}. This page checks automatically.`}</p>}
    {!loading && <>
      <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Send my brief and messages to OpenAI to tailor my prompt.</label>
      <p className={shared.small}>We save your AI brief, plan, chat and generated guide with this private {accessLabel} link so you can return on another device. Anyone with the link can read or edit them and use the allowance. Do not include passwords, API keys or private customer data. You can delete saved content below; deletion does not reset usage.</p>
      {!project && freeOverview ? <button className={shared.primary} disabled={locked || !available || !consent || !details.idea.trim()} onClick={() => void act("overview")}>Create my free overview</button> : <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void act("message"); }}>
        <label htmlFor="ai-message">What would you like to change?</label><textarea id="ai-message" value={message} maxLength={2000} rows={3} onChange={(event) => setMessage(event.target.value)} placeholder="For example: simplify the first version, change the design, or add a feature." disabled={locked || !available || state?.remaining === 0} />
        <div className={styles.actions}><button className={shared.primary} type="submit" disabled={locked || !available || !consent || !message.trim() || !details.idea.trim() || state?.remaining === 0}>{busy ? "Working…" : "Send message"}</button><span className={shared.small}>{message.length}/2,000 · One response uses one message</span></div>
      </form>}
      {!details.idea.trim() && <p className={shared.small}>Describe your idea in the brief above to start.</p>}
      {state?.remaining === 0 && <p className={shared.notice}>{trial ? `You’ve used all ${allowance} trial messages. Your saved plan and chat remain available to read and download.` : "You’ve used all 20 messages. Your saved plan, chat, and prompt remain available to read, apply and download."}</p>}
    </>}
    {error && <p role="alert" className={shared.notice}>{error}</p>}
    <p role="status" aria-live="polite" className={shared.small}>{busy ? "Working on your request…" : notice}</p>
    <div className={styles.actions}><button className={shared.secondary} disabled={busy || loading} onClick={() => void act("load")}>Refresh conversation</button>{state && Object.keys(state.projects).length > 0 && <button className={styles.textButton} disabled={locked} onClick={() => setConfirmClear(true)}>Delete saved AI content</button>}</div>
    {confirmClear && <div className={shared.notice}><p>Delete all saved AI briefs, plans, conversations and build guides for this {accessLabel}? Download anything you want to keep first. Message, overview and guide usage will stay.</p><div className={styles.actions}><button className={shared.secondary} disabled={locked} onClick={() => setConfirmClear(false)}>Keep content</button><button className={shared.secondary} disabled={locked} onClick={() => void act("clear")}>Delete content for this {accessLabel}</button></div></div>}
  </section>;
}
