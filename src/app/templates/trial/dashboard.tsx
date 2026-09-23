"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { TRIAL_MESSAGE_LIMIT, type TrialAccess } from "@/lib/templates/trial-contract";
import { downloadText, loadDraft, saveDraft } from "../browser-storage";
import { useTrialProject } from "./use-trial-project";
import styles from "./dashboard.module.css";

const quickPrompts = [
  {
    label: "Keep only the essentials",
    message: "Please turn this plan into a focused first release. Identify the one core user journey that proves the idea works, keep only the features required for that journey, and move everything else into a later phase. For each retained feature, explain the minimum behavior users need and any privacy or safety requirement that cannot be deferred. Update the overview and feature table, then list what you postponed and why.",
  },
  {
    label: "Make the design feel warmer",
    message: "Please revise the app's look and feel so it feels warmer, more welcoming, and easier to trust. Suggest a coherent direction for colors, typography, spacing, imagery, buttons, empty states, onboarding, and microcopy, tailored to the audience in my brief. Keep contrast and readability accessible. Update the plan to show where these design choices would appear in the first release.",
  },
  {
    label: "Suggest a starting budget",
    message: "Please recommend a practical starting budget for this app's first release. Separate one-time build work from monthly operating costs, identify the services this feature plan actually needs, and describe low-usage and growing-usage scenarios. State your usage assumptions, the largest cost drivers, and ways to keep costs down. Treat prices as estimates and flag anything that needs current provider pricing before I commit.",
  },
] as const;

export function TrialDashboard({ access, templateId, url }: { access: TrialAccess; templateId: TemplateId; url: string }) {
  const ai = useTrialProject(access, templateId);
  const [view, setView] = useState<"plan" | "chat">("plan");
  const [linkStatus, setLinkStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [consent, setConsent] = useState(false);
  const [legacyBrief, setLegacyBrief] = useState<Personalization>(emptyPersonalization);
  const [setup, setSetup] = useState<Personalization>(emptyPersonalization);
  const composer = useRef<HTMLTextAreaElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const template = templateCatalog.find((item) => item.id === templateId)!;
  const project = ai.state?.projects[templateId];
  const brief = project?.brief ?? ai.state?.initialBrief ?? legacyBrief;
  const plan = project?.plan;
  const pending = ai.busy || !!ai.state?.pending;
  const canUseAi = consent || ai.state?.overviewConsent === true;
  const remaining = ai.state?.remaining ?? TRIAL_MESSAGE_LIMIT;
  const overviewUsed = ai.state?.overviewUsed.includes(templateId);
  const canSend = !!ai.state && ai.available && canUseAi && !!brief.idea.trim() && !pending && remaining > 0;
  useEffect(() => {
    const node = composer.current;
    if (node) { node.style.height = "auto"; node.style.height = `${node.scrollHeight}px`; }
  }, [ai.message, view]);

  function suggest(text: string) { ai.setMessage(text); setView("chat"); requestAnimationFrame(() => composer.current?.focus()); }
  function switchView(next: "plan" | "chat") {
    setView(next);
    requestAnimationFrame(() => workspace.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  function exportPlan() {
    if (!project) return;
    const name = (brief.name || templateId).toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 60);
    downloadText(JSON.stringify({ template: templateId, brief: project.brief, plan: project.plan, conversation: project.history }, null, 2), `${name}-plan.json`);
  }
  function preparePurchase() {
    try { const draft = loadDraft(); saveDraft(brief, draft.mode, [templateId], draft.subagents, draft.skillTree, draft.appIcon); } catch { /* Purchase works without a local draft. */ }
  }

  return <div className={styles.dashboard}>
    <div className={styles.breadcrumb}><Link href="/templates/">Templates</Link><span aria-hidden="true">/</span><span>Project dashboard</span><span className={styles.trialBadge}>Free trial</span></div>
    <header className={styles.projectHeader}>
      <div className={styles.projectIdentity}><div className={styles.avatar} aria-hidden="true">{(brief.name || template.title).slice(0, 1).toUpperCase()}<span>↗</span></div><div><p className={styles.kicker}>{template.title} · Your workspace</p><h1>{brief.name || "Your new project"}</h1><p className={styles.subtitle}>Shape your idea. Make it yours.</p></div></div>
      <div className={styles.toolbar}>
        <details className={styles.access}><summary>Save private link <span aria-hidden="true">↗</span></summary><div className={styles.accessPopover}>
          <h2>Come back anytime</h2><p>This link opens your saved plan and chat on any device. Keep it private.</p>
          <label htmlFor="trial-url">Your private trial URL</label><input id="trial-url" value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
          <button onClick={async () => { try { await navigator.clipboard.writeText(url); setLinkStatus("Trial link copied."); } catch { setLinkStatus("Select the link above to copy it, or download your access file."); } }}>Copy trial link</button>
          <button onClick={() => downloadText(`YOUR PRIVATE TRIAL LINK\n\n${url}\n\nKeep this link private. It opens your saved AI plan and chat.`, "template-trial-access.txt")}>Download access file</button>
          <p role="status">{linkStatus}</p>
        </div></details>
        <button className={styles.downloadPlan} disabled={!project} onClick={exportPlan}>Download plan <span aria-hidden="true">↓</span></button>
      </div>
    </header>
    <div className={styles.projectMeta}><span><i aria-hidden="true" />{pending ? "Preparing your plan" : project ? "Plan saved" : "Workspace ready"}</span><span>{plan ? `${plan.features.length} features` : "Personalized feature plan"}</span><span>{project ? `Version ${project.revision}` : "Free overview included"}</span><span className={styles.checkoutStatus}>$0 · No payment required</span></div>
    <div className={styles.mobileSwitch} role="group" aria-label="Dashboard view"><button aria-pressed={view === "plan"} onClick={() => switchView("plan")}>Your plan</button><button aria-pressed={view === "chat"} onClick={() => switchView("chat")}>AI chat · {remaining} left</button></div>
    {ai.loading && <p className={styles.notice} role="status">Loading your saved workspace…</p>}
    {!ai.loading && !ai.state && <div className={styles.notice}><p role="alert">{ai.error || "Your workspace could not be loaded."}</p><button onClick={() => void ai.refresh()}>Retry loading workspace</button></div>}
    {ai.error && ai.state && view === "plan" && <div className={styles.mobileError}><p role="alert">{ai.error}</p><button disabled={ai.busy} onClick={() => void ai.refresh()}>Refresh conversation</button></div>}
    {!ai.loading && ai.state && <div ref={workspace} className={styles.workspace}>
      <section className={`${styles.planPane} ${view !== "plan" ? styles.mobileHidden : ""}`} aria-label="Your project plan">
        <div className={styles.paneHeading}><div><p className={styles.kicker}>The big picture</p><h2>Your app plan</h2></div><span className={styles.version}>{project ? `v${project.revision}` : "Draft"}</span></div>
        {!brief.idea.trim() && <form className={styles.setup} onSubmit={(event) => { event.preventDefault(); if (setup.idea.trim()) setLegacyBrief(setup); }}><h3>What are you making?</h3><p>Add a brief to start this workspace.</p><label>Project name <input maxLength={100} value={setup.name} onChange={(event) => setSetup({ ...setup, name: event.target.value })} placeholder="Give your idea a name (optional)" /></label><label>Project description <textarea required maxLength={3000} rows={4} value={setup.idea} onChange={(event) => setSetup({ ...setup, idea: event.target.value })} placeholder="Who is it for, and what should it help them do?" /></label><button className={styles.primary} disabled={!setup.idea.trim()} type="submit">Save idea</button></form>}
        {plan ? <>
          <p className={styles.overview}>{plan.overview}</p>
          <div className={styles.featureHeading}><h3>What it will do</h3><span>{plan.features.length} features</span></div>
          <table className={styles.features}><caption className={styles.srOnly}>Features for {brief.name || "your app"}</caption><thead><tr><th scope="col">Feature</th><th scope="col">How it works</th></tr></thead><tbody>{plan.features.map((feature, index) => <tr key={index}><th scope="row"><span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span>{feature.part}</th><td><p>{feature.description}</p><button className={styles.refine} disabled={pending || remaining <= 0} onClick={() => suggest(`Let’s change ${feature.part.toLowerCase()}: `)}>Refine <span aria-hidden="true">↗</span></button></td></tr>)}</tbody></table>
          {(plan.assumptions.length > 0 || plan.questions.length > 0) && <div className={styles.decisions}>
            {plan.assumptions.length > 0 && <details><summary>Working assumptions <span>{plan.assumptions.length}</span></summary><ul>{plan.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
            {plan.questions.length > 0 && <details open><summary>Decisions to make <span>{plan.questions.length}</span></summary><ul>{plan.questions.map((question, index) => <li key={index}><span>{question}</span><button disabled={pending || remaining <= 0} onClick={() => suggest(`About “${question}”: `)}>Answer in chat →</button></li>)}</ul></details>}
          </div>}
        </> : brief.idea.trim() && <div className={styles.emptyPlan}>
          <div className={styles.planSymbol} aria-hidden="true">✦</div>
          <h3>{pending ? "Turning your idea into a plan" : "Your idea is ready to take shape"}</h3>
          <p>{pending ? "AI is mapping out your overview and features. This can take a couple of minutes. Your editing messages stay untouched." : overviewUsed ? "Your previous plan was deleted. Use a remaining chat message to create a new version." : "Create your free overview to see the features your app needs."}</p>
          {pending ? <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div> : !overviewUsed && <button className={styles.primary} disabled={!ai.available || !canUseAi} onClick={() => void ai.generate("overview", brief)}>Create free overview</button>}
        </div>}
        {brief.idea.trim() && <details className={styles.originalBrief}><summary>Your original brief <span>View details</span></summary><p>{brief.idea}</p>{brief.features && <p><strong>Features & platforms</strong>{brief.features}</p>}{brief.style && <p><strong>Look & feel</strong>{brief.style}</p>}{(brief.budget || brief.decideBudget) && <p><strong>Running budget</strong>{brief.decideBudget ? "AI will recommend a starting budget" : brief.budget}</p>}</details>}
        <div className={styles.buildNext}><div><span className={styles.kicker}>When you’re ready</span><h3>Take your plan into the build.</h3><p>Get the full template and 20 editing messages with a purchase. Download this plan to keep your decisions.</p></div><Link onClick={preparePurchase} href="/templates/#bundle">Get the full template <span aria-hidden="true">↗</span></Link></div>
      </section>
      <aside className={`${styles.chatPane} ${view !== "chat" ? styles.mobileHidden : ""}`} aria-label="AI editing chat">
        <div className={styles.chatHeader}><div className={styles.aiMark} aria-hidden="true">✦</div><div><h2>Make it yours</h2><p>Chat with your AI editor</p></div><span className={styles.messageCount}>{remaining} left</span></div>
        <div className={styles.conversation} role="log" aria-label="Conversation" aria-live="polite" tabIndex={0}>
          <div className={styles.welcome}><span className={styles.kicker}>A little help, a lot of possibility</span><h3>What would you change?</h3><p>Add a feature, simplify the scope, or change the direction. Your plan updates here as you chat.</p></div>
          {project?.history.map((item, index) => <div key={index} className={item.role === "user" ? styles.userMessage : styles.aiMessage}><strong>{item.role === "user" ? "You" : "AI editor"}</strong><p>{item.text}</p></div>)}
          {!!plan?.questions.length && <section className={styles.decisionPrompts} aria-label="Decisions to make">
            <h3>Decisions to make <span>{plan.questions.length}</span></h3>
            <div>{plan.questions.map((question, index) => <button key={index} disabled={pending || remaining <= 0} onClick={() => suggest(`About “${question}”: `)}><span>{question}</span><span aria-hidden="true">Answer ↗</span></button>)}</div>
          </section>}
          {pending && <div className={styles.thinking} role="status"><span aria-hidden="true">✦</span> {project ? "Updating your plan…" : "Preparing your free overview…"}</div>}
          {!pending && !project?.history.some((item) => item.role === "user") && <div className={styles.suggestions}>{quickPrompts.map(({ label, message }) => <button key={label} disabled={!canSend} onClick={() => suggest(message)}>{label}<span aria-hidden="true">↗</span></button>)}</div>}
        </div>
        <div className={styles.composerArea}>
          {ai.error && <div className={styles.chatError}><p role="alert">{ai.error}</p><button disabled={ai.busy} onClick={() => void ai.refresh()}>Refresh conversation</button></div>}
          {!ai.available && <p className={styles.chatError}>AI editing is temporarily unavailable. Your saved plan is still here.</p>}
          {!ai.state.overviewConsent && <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Allow OpenAI to use my brief and messages to refine my plan. Chats are saved to this private link.</label>}
          {remaining === 0 ? <div className={styles.exhausted}><strong>Your trial messages are used.</strong><p>Your plan and chat are saved. Download your plan or get the full template to keep building.</p></div> : <form onSubmit={(event) => { event.preventDefault(); if (canSend && ai.message.trim()) void ai.generate("message", brief, ai.message); }}>
            <label className={styles.srOnly} htmlFor="trial-message">Ask for a change</label><textarea ref={composer} id="trial-message" rows={3} maxLength={2000} value={ai.message} disabled={pending || !ai.state} placeholder="Describe a change to your app…" onChange={(event) => ai.setMessage(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing && canSend && ai.message.trim()) { event.preventDefault(); void ai.generate("message", brief, ai.message); } }} />
            <div className={styles.composerBottom}><span>{ai.message.length}/2,000</span><button className={styles.primary} type="submit" disabled={!canSend || !ai.message.trim()}>{pending ? "Working…" : "Send change ↑"}</button></div>
          </form>}
          <p className={styles.allowance}>{remaining} of {ai.state.limit} editing messages left · Overview is free</p>
          <p className={styles.savedStatus} role="status">{ai.status}</p>
        </div>
      </aside>
    </div>}
    <div className={styles.downloadFooter}><button className={styles.downloadPlan} disabled={!project} onClick={exportPlan}>Download plan <span aria-hidden="true">↓</span></button></div>
    <footer className={styles.workspaceFooter}><p>AI helps shape your plan. Building the app happens in your coding tool.</p><details><summary>Manage saved content</summary><p>Delete the saved brief, plan, and conversation. This does not reset your message allowance.</p>{confirmDelete ? <div><button disabled={pending} onClick={async () => { await ai.clear(); setLegacyBrief(emptyPersonalization); setSetup(emptyPersonalization); setConsent(false); setConfirmDelete(false); }}>Confirm delete</button><button onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button disabled={pending || !ai.state} onClick={() => setConfirmDelete(true)}>Delete saved content</button>}</details></footer>
  </div>;
}
