"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { templateCatalog, type BuildMode, type TemplateId } from "@/lib/templates/catalog";
import { composePrompt, composeSkillSetupPrompt, emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { site } from "@/lib/site";
import { downloadText, loadDraft, loadReceipts, receiptLink, saveDraft, saveReceipt, type Receipt } from "../browser-storage";
import { Personalize } from "../personalize";
import { AiEditor } from "./ai-editor";
import { AppIconGenerator } from "./app-icon-generator";
import { ManagedLaunch, hasManagedLaunch } from "../managed-launch";
import { sameBrief, type AppPlan, type AiProject } from "@/lib/templates/ai-contract";
import { BuildGuide } from "./build-guide";
import styles from "../templates.module.css";

export function TemplateLibrary() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [active, setActive] = useState<Receipt | null>(null);
  const [templates, setTemplates] = useState<{ id: TemplateId; foundation: string }[]>([]);
  const [selected, setSelected] = useState<TemplateId | "">("");
  const [details, setDetails] = useState<Personalization>(emptyPersonalization);
  const [mode, setMode] = useState<BuildMode>("manual");
  const [subagentInstructions, setSubagentInstructions] = useState<string | undefined>();
  const [includeSubagents, setIncludeSubagents] = useState(false);
  const [skillTreeInstructions, setSkillTreeInstructions] = useState<string | undefined>();
  const [includeSkillTree, setIncludeSkillTree] = useState(false);
  const [appIconPurchased, setAppIconPurchased] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState<Partial<Record<TemplateId, { plan: AppPlan; brief: Personalization }>>>({});
  const [projects, setProjects] = useState<Partial<Record<TemplateId, AiProject>>>({});
  const orderRequest = useRef({ generation: 0 });

  async function openOrder(receipt: Receipt) {
    setApplied({});
    setProjects({});
    const requestId = ++orderRequest.current.generation;
    setBusy(true); setError(""); setStatus(""); setActive(receipt); setTemplates([]); setSelected(""); setSubagentInstructions(undefined); setIncludeSubagents(false); setSkillTreeInstructions(undefined); setIncludeSkillTree(false); setAppIconPurchased(false);
    // Keep bookmarks tied to the active order, including when browser storage is unavailable.
    // The private credential stays in the fragment, which is not sent in HTTP requests.
    history.replaceState(history.state, "", receiptLink(receipt));
    try {
      const response = await fetch("/api/templates/library/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: receipt.sessionId, accessToken: receipt.accessToken }) });
      const data = await response.json();
      if (requestId !== orderRequest.current.generation) return;
      if (!response.ok) throw new Error(data.error);
      setTemplates(data.templates); setSelected(data.templates[0].id);
      const purchasedAddon = data.subagents === true && typeof data.subagentInstructions === "string" && data.subagentInstructions.trim().length > 0;
      setSubagentInstructions(purchasedAddon ? data.subagentInstructions : undefined); setIncludeSubagents(purchasedAddon);
      const purchasedSkillTree = data.skillTree === true && typeof data.skillTreeInstructions === "string" && data.skillTreeInstructions.trim().length > 0;
      setSkillTreeInstructions(purchasedSkillTree ? data.skillTreeInstructions : undefined); setIncludeSkillTree(purchasedSkillTree);
      const purchasedAppIcon = data.appIcon === true;
      setAppIconPurchased(purchasedAppIcon);
      const updated = { ...receipt, templates: data.templates.map((t: { id: TemplateId }) => t.id), subagents: purchasedAddon, skillTree: purchasedSkillTree, appIcon: purchasedAppIcon };
      setActive(updated);
      try { saveReceipt(updated); setReceipts(loadReceipts()); } catch { setStatus("Browser storage is unavailable. Save your private access link below."); }
      try { sessionStorage.removeItem("runit-template-checkout"); } catch { /* The verified order is still usable. */ }
    } catch (cause) { if (requestId === orderRequest.current.generation) setError(cause instanceof Error ? cause.message : "We could not open this order. Please try again."); }
    finally { if (requestId === orderRequest.current.generation) setBusy(false); }
  }

  useEffect(() => {
    const pendingRequests = orderRequest.current;
    const draft = loadDraft(); setDetails(draft.details); setMode(draft.mode);
    setLoaded(true);
    function openFromUrl() {
      const saved = loadReceipts(); setReceipts(saved);
      const hash = new URLSearchParams(location.hash.slice(1));
      const sessionId = hash.get("session_id"); const accessToken = hash.get("access");
      if (sessionId && accessToken && /^cs_[A-Za-z0-9_]+$/.test(sessionId) && /^[a-f0-9]{64}$/.test(accessToken)) {
        const receipt: Receipt = saved.find((r) => r.sessionId === sessionId && r.accessToken === accessToken) ?? { sessionId, accessToken, templates: [], createdAt: new Date().toISOString() };
        // Do not replace a previously saved credential with an unverified incoming link.
        if (!saved.some((r) => r.sessionId === sessionId)) {
          try { saveReceipt(receipt); setReceipts(loadReceipts()); } catch { /* The URL still restores this order without browser storage. */ }
        }
        void openOrder(receipt);
      } else if (!location.hash && saved[0]) {
        void openOrder(saved[0]);
      } else {
        setApplied({});
        setProjects({});
        ++orderRequest.current.generation;
        setActive(null); setTemplates([]); setSelected(""); setSubagentInstructions(undefined); setIncludeSubagents(false); setSkillTreeInstructions(undefined); setIncludeSkillTree(false); setAppIconPurchased(false); setBusy(false); setStatus("");
        setError(location.hash ? "This purchase link is incomplete or invalid. Open the full URL from your saved access file, or choose one of your saved orders." : "");
      }
    }
    openFromUrl();
    window.addEventListener("hashchange", openFromUrl);
    return () => { window.removeEventListener("hashchange", openFromUrl); ++pendingRequests.generation; };
  }, []);

  const current = templates.find((template) => template.id === selected);
  const purchaseUrl = active ? receiptLink(active) : "";
  const title = templateCatalog.find((t) => t.id === selected)?.title ?? "Template";
  const savedPlan = selected ? applied[selected] : undefined;
  const appPlan = savedPlan && sameBrief(savedPlan.brief, details) ? savedPlan.plan : undefined;
  const project = selected ? projects[selected] : undefined;
  const currentGuide = project?.guide && project.guide.sourceRevision === project.revision && project.appliedRevision === project.revision && sameBrief(project.guide.brief, details) ? project.guide : undefined;
  const prompt = current ? composePrompt(title, current.foundation, details, mode, includeSubagents ? subagentInstructions : undefined, includeSkillTree ? skillTreeInstructions : undefined, appPlan, currentGuide) : "";
  const setupPrompt = skillTreeInstructions ? composeSkillSetupPrompt(skillTreeInstructions, details, mode) : "";
  function updateDetails(value: Personalization) { setDetails(value); try { const draft = loadDraft(); saveDraft(value, mode, draft.selected, draft.subagents, draft.skillTree, draft.appIcon); } catch { /* Editing still works. */ } }
  function updateMode(value: BuildMode) { setMode(value); try { const draft = loadDraft(); saveDraft(details, value, draft.selected, draft.subagents, draft.skillTree, draft.appIcon); } catch { /* Editing still works. */ } }
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setStatus(message); }
    catch { setStatus("Copy isn’t available here. Use the download button, or select the text below and copy it."); }
  }
  return <>
    <section className={styles.libraryHero}><p className={styles.eyebrow}>Your next project starts here</p><h1>Make it <em>yours.</em></h1><p className={styles.muted}>Describe your idea, review the AI plan, then create your complete build guide and HTML prototype. Take the included prompt to your coding AI to build the app. Both build modes are included.</p>{selected && hasManagedLaunch(selected) && <button className={styles.launchShortcut} type="button" onClick={() => document.getElementById("managed-launch")?.scrollIntoView({ behavior: "smooth" })}>Want us to host or run it? Request a quote →</button>}</section>
    {receipts.length > 0 && <div className={styles.orderPicker}><label htmlFor="order">Saved orders on this browser</label><select id="order" value={active?.sessionId ?? ""} disabled={busy} onChange={(event) => { const receipt = receipts.find((r) => r.sessionId === event.target.value); if (receipt) void openOrder(receipt); }}><option value="" disabled>Choose an order</option>{receipts.map((r) => <option key={r.sessionId} value={r.sessionId}>{r.createdAt.slice(0, 10)} · {r.templates.length || "Your"} templates · …{r.sessionId.slice(-8)}</option>)}</select></div>}
    {busy && <p className={styles.notice} role="status">Verifying your payment and opening your templates…</p>}
    {error && <div className={styles.notice} role="alert"><p>{error}</p>{active && <button className={styles.secondary} disabled={busy} onClick={() => void openOrder(active)}>Check payment again</button>}<p className={styles.small}>If your bank is still processing the payment, come back to this saved order later. Need help? Email <a href={`mailto:${site.email}`}>{site.email}</a> with your Stripe receipt.</p></div>}
    {loaded && !receipts.length && !active && !error && <div className={styles.empty}><h2>Your templates will live here.</h2><p>After checkout, come back here to copy or download. If you purchased on another device, open your saved private access link.</p><Link className={styles.primary} href="/templates/">Explore templates →</Link><p className={styles.small}>Lost your link? Email <a href={`mailto:${site.email}`}>{site.email}</a> with your payment receipt for help.</p></div>}
    {active && <section className={styles.accessBar} aria-labelledby="save-purchase-heading">
      <p className={styles.eyebrow}>Your private order page</p>
      <h2 id="save-purchase-heading">Save your purchase link</h2>
      <p className={styles.accessIntro}>Save this URL before you leave. It opens every prompt, add-on and saved AI conversation in this purchase, even on another device or after clearing your browser.</p>
      <label className={styles.small} htmlFor="purchase-url">Your private purchase URL</label>
      <input id="purchase-url" className={styles.purchaseUrl} type="text" readOnly value={purchaseUrl} spellCheck={false} autoComplete="off" onFocus={(event) => event.currentTarget.select()} />
      <div className={styles.actions}><button className={styles.primary} onClick={() => void copy(purchaseUrl, "Purchase link copied. Save it somewhere safe so you can return to this order.")}>Copy purchase link</button><button className={styles.secondary} onClick={() => downloadText(`YOUR PRIVATE TEMPLATE PURCHASE LINK\n\n${purchaseUrl}\n\nSave this file. Open the full URL to return to the templates and add-ons in this order, including on another device or after clearing browser storage. Payment must be complete to access the prompts.\n\nKeep this URL private: anyone with it can access your purchase. Manual edits stay in your browser. AI plans and chats are saved with this purchase when you use AI editing; download your personalized prompts to keep a copy.\n\nLost access? Contact ${site.email} with your Stripe receipt. Never send passwords or API keys.\n`, "template-order-access.txt")}>Download access file</button></div>
      <p className={styles.small}>You can also bookmark this page. Keep the full URL private: anyone with it can access your purchase. Download your personalized prompts to keep a copy. Manual edits stay in this browser; AI plans and chats are saved to this purchase.</p>
    </section>}
    <p className={styles.status} role="status" aria-label="Template library status" aria-live="polite">{status}</p>
    {templates.length > 0 && <>
      <section className={styles.libraryTemplates}><p className={styles.eyebrow}>Your purchased foundations</p><div className={styles.libraryTabs} role="group" aria-label="Choose a purchased template">{templates.map((t) => <button key={t.id} aria-pressed={selected === t.id} onClick={() => setSelected(t.id)}>{templateCatalog.find((item) => item.id === t.id)?.title}</button>)}</div></section>
      <section className={styles.workshop}><Personalize details={details} mode={mode} onDetails={updateDetails} onMode={updateMode} /></section>
      {active && current && <AiEditor key={`${active.sessionId}:${active.accessToken}:${current.id}`} receipt={active} templateId={current.id} details={details} onRestoreBrief={updateDetails} onCleared={() => { setApplied({}); setProjects({}); }} onProject={(value) => setProjects((previous) => ({ ...previous, [current.id]: value ?? undefined }))} onApplied={(plan, brief) => setApplied((previous) => ({ ...previous, [current.id]: plan && brief ? { plan, brief } : undefined }))} />}
      {savedPlan && !appPlan && <p className={styles.notice}>You changed the brief after applying an AI plan. The download currently uses your new brief without the older plan. Update and apply the plan to include it again.</p>}
      {subagentInstructions ? <label className={`${styles.addon} ${styles.libraryAddon}`} data-selected={includeSubagents}>
        <input type="checkbox" aria-label="Include subagent workflow" checked={includeSubagents} onChange={(event) => setIncludeSubagents(event.target.checked)} />
        <span><strong>Include subagent workflow <b>Purchased</b></strong><span>Let a lead AI such as Astra oversee cheaper coding agents. Included for every template in this order; you can turn it off for any download.</span><small>Uses the models and agent tools available to you. Manual mode keeps you in charge of applying changes. AI usage is billed by your provider.</small></span>
      </label> : <p className={`${styles.small} ${styles.libraryAddon}`}>Subagent workflow was not included in this order.</p>}
      {skillTreeInstructions ? <section className={styles.skillSetup} aria-label="Purchased skill tree setup">
        <label className={`${styles.addon} ${styles.libraryAddon}`} data-selected={includeSkillTree}>
          <input type="checkbox" aria-label="Include skill tree setup" checked={includeSkillTree} onChange={(event) => setIncludeSkillTree(event.target.checked)} />
          <span><strong>Include skill tree setup <b>Purchased</b></strong><span>Your skill directory and installation workflow, matched to the templates in this order. Include it in your app prompt or run the setup prompt first.</span><small>Source links, supported installation steps, connection checks and upkeep. Third-party skills keep their own licenses; account access and service fees are separate.</small></span>
        </label>
        <div className={styles.actions}><button className={styles.secondary} onClick={() => downloadText(setupPrompt, "skill-tree-setup-prompt.txt")}>Download skill setup .txt</button><button className={styles.secondary} onClick={() => void copy(setupPrompt, "Skill setup prompt copied. Paste it into your AI tool to prepare your workspace.")}>Copy skill setup prompt</button></div>
        <details className={styles.sample}><summary>Preview skill setup prompt <span>↗</span></summary><pre>{setupPrompt}</pre></details>
      </section> : <p className={`${styles.small} ${styles.libraryAddon}`}>Skill tree setup was not included in this order.</p>}
      {appIconPurchased && active && current && <AppIconGenerator key={`${active.sessionId}:${active.accessToken}`} receipt={active} templateId={current.id} details={details} />}
      {project?.guide && current && <BuildGuide key={`${active?.sessionId}:${current.id}`} project={project} details={details} title={title} foundation={current.foundation} mode={mode} subagents={includeSubagents ? subagentInstructions : undefined} skillTree={includeSkillTree ? skillTreeInstructions : undefined} />}
      <section className={styles.promptOutput}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Ready for your AI</p><h2>{title} prompt</h2></div><div className={styles.actions}><button className={styles.secondary} onClick={() => downloadText(prompt, `${selected}-prompt.txt`)}>Download .txt</button><button className={styles.primary} onClick={() => void copy(prompt, `${title} prompt copied. Paste it into your AI tool to begin.`)}>Copy full prompt ↗</button></div></div><label className={styles.small} htmlFor="full-prompt">Your brief + {mode === "computer" ? "computer control" : "manual"} instructions + complete foundation{includeSubagents && subagentInstructions ? " + subagent workflow" : ""}{includeSkillTree && skillTreeInstructions ? " + skill tree setup" : ""}</label><textarea id="full-prompt" readOnly value={prompt} rows={20} spellCheck={false} /><p className={styles.small}>Replace any bracketed placeholders before starting. You can return, change the brief or mode, and download again. Your AI is also instructed to create FOLLOW_UP_PROMPTS.md in your project with useful prompts to ask next.</p></section>
      {selected && hasManagedLaunch(selected) && <ManagedLaunch templateId={selected} projectName={details.name} />}
    </>}
    <p className={styles.libraryBack}><Link href="/templates/">← Back to all templates</Link></p>
  </>;
}
