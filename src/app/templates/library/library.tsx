"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { templateCatalog, type BuildMode, type TemplateId } from "@/lib/templates/catalog";
import { composePrompt, composeSkillSetupPrompt, emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { site } from "@/lib/site";
import { downloadText, loadDraft, loadReceipts, receiptLink, receiptName, saveDraft, saveReceipt, saveReceiptNames, withReceiptNames, type Receipt, type ReceiptProjectNames } from "../browser-storage";
import { Personalize } from "../personalize";
import { AiEditor, type WorkspaceTab } from "./ai-editor";
import { AppIconGenerator } from "./app-icon-generator";
import { ManagedLaunch, hasManagedLaunch } from "../managed-launch";
import { sameBrief, type AppPlan, type AiProject } from "@/lib/templates/ai-contract";
import { BuildGuide } from "./build-guide";
import styles from "../templates.module.css";
import dashboard from "../trial/dashboard.module.css";
import library from "./library.module.css";

export function TemplateLibrary() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [active, setActive] = useState<Receipt | null>(null);
  const [templates, setTemplates] = useState<{ id: TemplateId; foundation: string }[]>([]);
  const [selected, setSelected] = useState<TemplateId | "">("");
  const [details, setDetails] = useState<Personalization>(emptyPersonalization);
  const [mode, setMode] = useState<BuildMode>("manual");
  const [subagentInstructions, setSubagentInstructions] = useState<string | undefined>();
  const [skillTreeInstructions, setSkillTreeInstructions] = useState<string | undefined>();
  const [appIconPurchased, setAppIconPurchased] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("plan");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState<Partial<Record<TemplateId, { plan: AppPlan; brief: Personalization }>>>({});
  const [projects, setProjects] = useState<Partial<Record<TemplateId, AiProject>>>({});
  const orderRequest = useRef({ generation: 0 });

  const rememberNames = useCallback((receipt: Receipt, names: ReceiptProjectNames, overwrite = true) => {
    setReceipts((saved) => saved.map((r) => r.sessionId === receipt.sessionId && r.accessToken === receipt.accessToken ? withReceiptNames(r, names, overwrite) : r));
    try { saveReceiptNames(receipt, names, overwrite); } catch { /* Names still work in this tab when browser storage is unavailable. */ }
  }, []);

  async function openOrder(receipt: Receipt) {
    setWorkspaceTab("plan");
    setApplied({});
    setProjects({});
    const requestId = ++orderRequest.current.generation;
    setBusy(true); setError(""); setStatus(""); setActive(receipt); setTemplates([]); setSelected(""); setSubagentInstructions(undefined); setSkillTreeInstructions(undefined); setAppIconPurchased(false);
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
      setSubagentInstructions(purchasedAddon ? data.subagentInstructions : undefined);
      const purchasedSkillTree = data.skillTree === true && typeof data.skillTreeInstructions === "string" && data.skillTreeInstructions.trim().length > 0;
      setSkillTreeInstructions(purchasedSkillTree ? data.skillTreeInstructions : undefined);
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
        setActive(null); setTemplates([]); setSelected(""); setSubagentInstructions(undefined); setSkillTreeInstructions(undefined); setAppIconPurchased(false); setBusy(false); setStatus("");
        setError(location.hash ? "This purchase link is incomplete or invalid. Open the full URL from your saved access file, or choose one of your saved orders." : "");
      }
    }
    openFromUrl();
    window.addEventListener("hashchange", openFromUrl);
    return () => { window.removeEventListener("hashchange", openFromUrl); ++pendingRequests.generation; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function restoreOrderNames() {
      for (const receipt of loadReceipts().filter((r) => r.projectNames === undefined)) {
        if (controller.signal.aborted) return;
        try {
          // This reads saved plans only; it never generates content or uses an AI message.
          const response = await fetch("/api/templates/ai/", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ action: "load", sessionId: receipt.sessionId, accessToken: receipt.accessToken }) });
          if (!response.ok) continue;
          const data = await response.json();
          if (controller.signal.aborted || !data.state?.projects) continue;
          const names: ReceiptProjectNames = {};
          for (const template of templateCatalog) {
            const name = data.state.projects[template.id]?.brief?.name;
            if (typeof name === "string") names[template.id] = name.trim().slice(0, 100);
          }
          // A rename made while this request was running takes precedence.
          rememberNames(receipt, names, false);
        } catch { /* Keep the template-name fallback if a saved order cannot be read. */ }
      }
    }
    void restoreOrderNames();
    return () => controller.abort();
  }, [rememberNames]);

  const current = templates.find((template) => template.id === selected);
  const purchaseUrl = active ? receiptLink(active) : "";
  const title = templateCatalog.find((t) => t.id === selected)?.title ?? "Template";
  const savedPlan = selected ? applied[selected] : undefined;
  const appPlan = savedPlan && sameBrief(savedPlan.brief, details) ? savedPlan.plan : undefined;
  const project = selected ? projects[selected] : undefined;
  const currentGuide = project?.guide && project.guide.sourceRevision === project.revision && project.appliedRevision === project.revision && sameBrief(project.guide.brief, details) ? project.guide : undefined;
  const prompt = current ? composePrompt(title, current.foundation, details, mode, subagentInstructions, skillTreeInstructions, appPlan, currentGuide) : "";
  const setupPrompt = skillTreeInstructions ? composeSkillSetupPrompt(skillTreeInstructions, details, mode) : "";
  function updateDetails(value: Personalization) {
    setDetails(value);
    if (active && selected) rememberNames(active, { [selected]: value.name.trim() });
    try { const draft = loadDraft(); saveDraft(value, mode, draft.selected, draft.subagents, draft.skillTree, draft.appIcon); } catch { /* Editing still works. */ }
  }
  function updateMode(value: BuildMode) { setMode(value); try { const draft = loadDraft(); saveDraft(details, value, draft.selected, draft.subagents, draft.skillTree, draft.appIcon); } catch { /* Editing still works. */ } }
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setStatus(message); }
    catch { setStatus("Copy isn’t available here. Use the download button, or select the text below and copy it."); }
  }
  const buildFiles = <>
      {savedPlan && !appPlan && <p className={styles.notice}>You changed the app details after applying an AI plan. The download uses your new details without the older plan. Update and apply the plan to include it again.</p>}
      {project?.guide && current && <BuildGuide key={`${active?.sessionId}:${current.id}`} project={project} details={details} title={title} foundation={current.foundation} mode={mode} subagents={subagentInstructions} skillTree={skillTreeInstructions} />}
      <section className={`${styles.promptOutput} ${library.promptOutput}`}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Ready for your AI</p><h2>{title} prompt</h2></div><div className={styles.actions}><button className={styles.secondary} onClick={() => downloadText(prompt, `${selected}-prompt.txt`)}>Download .txt</button><button className={styles.primary} onClick={() => void copy(prompt, `${title} prompt copied. Paste it into your AI tool to begin.`)}>Copy full prompt ↗</button></div></div><label className={styles.small} htmlFor="full-prompt">Your app details + {mode === "computer" ? "computer control" : "manual"} instructions + complete foundation{subagentInstructions ? " + subagent workflow" : ""}{skillTreeInstructions ? " + skill tree setup" : ""}</label><textarea id="full-prompt" readOnly value={prompt} rows={20} spellCheck={false} /><p className={styles.small}>Replace any bracketed placeholders before starting. You can return, change the app details or mode, and download again. Your AI is also instructed to create FOLLOW_UP_PROMPTS.md in your project with useful prompts to ask next.</p></section>
  </>;
  const addons = <>
      {(subagentInstructions || skillTreeInstructions) && <section className={library.extras} aria-label="Your purchased extras">
        <div className={dashboard.paneHeading}><div><p className={dashboard.kicker}>Ready to use</p><h2>Your add-ons</h2></div></div>
        <p className={library.extrasIntro}>Purchased workflows are already included in your full build prompt. Use the actions here to copy or download them separately.</p>
        {subagentInstructions && <article className={library.addonCard} aria-labelledby="subagent-addon-heading">
          <div className={library.addonHeading}><h3 id="subagent-addon-heading">Subagent workflow</h3><span>Purchased</span></div>
          <p>Your build prompt tells a lead AI how to delegate bounded coding tasks and verify the results. Copy it into your coding AI to start building.</p>
          <div className={library.addonActions}><button className={styles.primary} type="button" onClick={() => void copy(prompt, "Full build prompt copied with your subagent workflow. Paste it into your coding AI to begin.")}>Copy build prompt</button><button className={styles.secondary} type="button" onClick={() => void copy(subagentInstructions, "Subagent workflow copied. Paste it into your coding AI alongside your app prompt.")}>Copy workflow only</button><button className={styles.secondary} type="button" onClick={() => downloadText(subagentInstructions, "subagent-workflow.txt")}>Download workflow .txt</button></div>
          <details className={library.addonPreview}><summary>Preview workflow instructions <span aria-hidden="true">↗</span></summary><pre>{subagentInstructions}</pre></details>
        </article>}
        {skillTreeInstructions && <article className={library.addonCard} aria-labelledby="skill-tree-addon-heading">
          <div className={library.addonHeading}><h3 id="skill-tree-addon-heading">Skill tree setup</h3><span>Purchased</span></div>
          <p>Paste the setup prompt into your AI tool to prepare your workspace first. The full build prompt also includes your skill tree instructions.</p>
          <div className={library.addonActions}><button className={styles.primary} type="button" onClick={() => void copy(setupPrompt, "Skill setup prompt copied. Paste it into your AI tool to prepare your workspace.")}>Copy setup prompt</button><button className={styles.secondary} type="button" onClick={() => downloadText(setupPrompt, "skill-tree-setup-prompt.txt")}>Download setup .txt</button><button className={styles.secondary} type="button" onClick={() => void copy(prompt, "Full build prompt copied with your skill tree setup. Paste it into your coding AI to begin.")}>Copy build prompt</button></div>
          <details className={library.addonPreview}><summary>Preview setup prompt <span aria-hidden="true">↗</span></summary><pre>{setupPrompt}</pre></details>
        </article>}
      </section>}
      {!subagentInstructions && !skillTreeInstructions && !appIconPurchased && <section className={library.extras} aria-label="Your purchased extras"><div className={dashboard.paneHeading}><div><p className={dashboard.kicker}>Add-ons</p><h2>Your add-ons</h2></div></div><p className={library.extrasIntro}>This purchase includes the full template. No add-ons were included.</p></section>}
      {appIconPurchased && active && current && <AppIconGenerator key={`${active.sessionId}:${active.accessToken}`} receipt={active} templateId={current.id} details={details} />}
      {selected && hasManagedLaunch(selected) && <ManagedLaunch templateId={selected} projectName={details.name} />}
  </>;
  return <div className={`${dashboard.dashboard} ${library.library}`} data-paid-dashboard>
    <div className={dashboard.breadcrumb}><Link href="/templates/">Templates</Link><span aria-hidden="true">/</span><span>Project dashboard</span>{!!templates.length && <span className={dashboard.trialBadge}>Purchased</span>}</div>
    <header className={dashboard.projectHeader}>
      <div className={dashboard.projectIdentity}><div className={dashboard.avatar} aria-hidden="true">{(details.name || title).slice(0, 1).toUpperCase()}<span>↗</span></div><div><p className={dashboard.kicker}>{current ? `${title} · Your workspace` : "Your template workspace"}</p><h1>{current ? details.name || "Your new project" : "Your templates"}</h1><p className={dashboard.subtitle}>Shape your idea. Make it yours.</p></div></div>
      <div className={dashboard.toolbar}>
        {selected && hasManagedLaunch(selected) && <button className={dashboard.launchShortcut} type="button" onClick={() => { document.getElementById("workspace-tab-addons")?.click(); requestAnimationFrame(() => document.getElementById("managed-launch")?.scrollIntoView({ behavior: "smooth" })); }}>Have us launch it <span aria-hidden="true">↗</span></button>}
        {active && <details className={dashboard.access}><summary>Save private link <span aria-hidden="true">↗</span></summary><div className={dashboard.accessPopover}>
          <h2>Save your purchase link</h2><p>This link opens every template, add-on and saved AI conversation in this order on any device. Keep it private.</p>
          <label htmlFor="purchase-url">Your private purchase URL</label><input id="purchase-url" type="text" readOnly value={purchaseUrl} spellCheck={false} autoComplete="off" onFocus={(event) => event.currentTarget.select()} />
          <button onClick={() => void copy(purchaseUrl, "Purchase link copied. Save it somewhere safe so you can return to this order.")}>Copy purchase link</button>
          <button onClick={() => downloadText(`YOUR PRIVATE TEMPLATE PURCHASE LINK\n\n${purchaseUrl}\n\nSave this file. Open the full URL to return to the templates and add-ons in this order, including on another device or after clearing browser storage. Payment must be complete to access the prompts.\n\nKeep this URL private: anyone with it can access your purchase. Manual edits stay in your browser. AI plans and chats are saved with this purchase when you use AI editing; download your personalized prompts to keep a copy.\n\nLost access? Contact ${site.email} with your Stripe receipt. Never send passwords or API keys.\n`, "template-order-access.txt")}>Download access file</button>
          <p>You can also bookmark this page. Manual edits stay in this browser; AI plans and chats are saved to your purchase.</p>
        </div></details>}
        {current && <button className={dashboard.downloadPlan} onClick={() => downloadText(prompt, `${selected}-prompt.txt`)}>Download prompt <span aria-hidden="true">↓</span></button>}
      </div>
    </header>
    {(receipts.length > 1 || (receipts.length > 0 && (!active || !!error))) && <div className={styles.orderPicker}><label htmlFor="order">Saved orders on this browser</label><select id="order" value={active?.sessionId ?? ""} disabled={busy} onChange={(event) => { const receipt = receipts.find((r) => r.sessionId === event.target.value); if (receipt) void openOrder(receipt); }}><option value="" disabled>Choose an app</option>{receipts.map((r) => <option key={r.sessionId} value={r.sessionId}>{receiptName(r)}</option>)}</select></div>}
    {busy && <p className={styles.notice} role="status">Verifying your payment and opening your templates…</p>}
    {error && <div className={styles.notice} role="alert"><p>{error}</p>{active && <button className={styles.secondary} disabled={busy} onClick={() => void openOrder(active)}>Check payment again</button>}<p className={styles.small}>If your bank is still processing the payment, come back to this saved order later. Need help? Email <a href={`mailto:${site.email}`}>{site.email}</a> with your Stripe receipt.</p></div>}
    {loaded && !receipts.length && !active && !error && <div className={styles.empty}><h2>Your templates will live here.</h2><p>After checkout, come back here to copy or download. If you purchased on another device, open your saved private access link.</p><Link className={styles.primary} href="/templates/">Explore templates →</Link><p className={styles.small}>Lost your link? Email <a href={`mailto:${site.email}`}>{site.email}</a> with your payment receipt for help.</p></div>}
    <p className={`${styles.status} ${library.status}`} role="status" aria-label="Template library status" aria-live="polite">{status}</p>
    {templates.length > 0 && <>
      {templates.length > 1 && <section className={styles.libraryTemplates}><p className={styles.eyebrow}>Your purchased foundations</p><div className={styles.libraryTabs} role="group" aria-label="Choose a purchased template">{templates.map((t) => <button key={t.id} aria-pressed={selected === t.id} onClick={() => { setSelected(t.id); setWorkspaceTab("plan"); }}>{templateCatalog.find((item) => item.id === t.id)?.title}</button>)}</div></section>}
      {active && current && <AiEditor key={`${active.sessionId}:${active.accessToken}:${current.id}`} receipt={active} templateId={current.id} details={details} activeTab={workspaceTab} onTabChange={setWorkspaceTab} buildFiles={buildFiles} addons={addons} purchasedAddons={{ subagents: !!subagentInstructions, skillTree: !!skillTreeInstructions, appIcon: appIconPurchased }} briefEditor={<Personalize compact details={details} mode={mode} onDetails={updateDetails} onMode={updateMode} />} onRestoreBrief={updateDetails} onCleared={() => { setApplied({}); setProjects({}); }} onProject={(value) => setProjects((previous) => ({ ...previous, [current.id]: value ?? undefined }))} onApplied={(plan, brief) => setApplied((previous) => ({ ...previous, [current.id]: plan && brief ? { plan, brief } : undefined }))} />}

    </>}
    <p className={styles.libraryBack}><Link href="/templates/">← Back to all templates</Link></p>
  </div>;
}
