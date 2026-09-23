"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { TRIAL_MESSAGE_LIMIT, type TrialAccess } from "@/lib/templates/trial-contract";
import { planTechnicalDetails } from "@/lib/templates/technical-details";
import { downloadText, loadDraft, saveDraft } from "../browser-storage";
import { useTrialProject } from "./use-trial-project";
import { ManagedLaunch, hasManagedLaunch } from "../managed-launch";
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

function appendDraft(current: string, suggestion: string): string {
  if (current.includes(suggestion)) return current;
  const separator = current && !current.endsWith("\n\n") ? current.endsWith("\n") ? "\n" : "\n\n" : "";
  const next = `${current}${separator}${suggestion}`;
  return next.length <= 2000 ? next : current;
}

function hasDecisionAnswer(message: string, question: string): boolean {
  const prefix = `About “${question}”: `;
  return message.split("\n").some((line) => line.startsWith(prefix) && !!line.slice(prefix.length).trim());
}

export function TrialDashboard({ access, templateId, url }: { access: TrialAccess; templateId: TemplateId; url: string }) {
  const ai = useTrialProject(access, templateId);
  const [view, setView] = useState<"plan" | "chat">("plan");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [flippedFeature, setFlippedFeature] = useState<string | null>(null);
  const [hoverSuppressedFeature, setHoverSuppressedFeature] = useState<string | null>(null);
  const [exitingDecisions, setExitingDecisions] = useState<string[]>([]);
  const [customDecision, setCustomDecision] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const [linkStatus, setLinkStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [consent, setConsent] = useState(false);
  const [legacyBrief, setLegacyBrief] = useState<Personalization>(emptyPersonalization);
  const [setup, setSetup] = useState<Personalization>(emptyPersonalization);
  const composer = useRef<HTMLTextAreaElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const exitTimers = useRef<number[]>([]);
  const template = templateCatalog.find((item) => item.id === templateId)!;
  const project = ai.state?.projects[templateId];
  const brief = project?.brief ?? ai.state?.initialBrief ?? legacyBrief;
  const plan = project?.plan;
  const technical = plan ? planTechnicalDetails(plan, templateId) : null;
  const pending = ai.busy || !!ai.state?.pending;
  const canUseAi = consent || ai.state?.overviewConsent === true;
  const remaining = ai.state?.remaining ?? TRIAL_MESSAGE_LIMIT;
  const overviewUsed = ai.state?.overviewUsed.includes(templateId);
  const canSend = !!ai.state && ai.available && canUseAi && !!brief.idea.trim() && !pending && remaining > 0;
  const decisions = plan?.questions.map((question, index) => ({ question, key: `${project?.revision ?? 0}:${index}` })) ?? [];
  const isAnswered = (question: string) => hasDecisionAnswer(ai.message, question) || !!project?.history.some((item) => item.role === "user" && hasDecisionAnswer(item.text, question));
  const unansweredDecisions = decisions.filter(({ question }) => !isAnswered(question));
  const visibleDecisions = decisions.filter(({ question, key }) => !isAnswered(question) || exitingDecisions.includes(key)).slice(0, 3);
  useEffect(() => {
    const node = composer.current;
    if (node) { node.style.height = "auto"; node.style.height = `${node.scrollHeight}px`; }
  }, [ai.message, view]);
  useEffect(() => () => exitTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  function canAddToDraft(text: string) {
    return appendDraft(ai.message, text) !== ai.message;
  }
  function addToDraft(text: string, focus = true): boolean {
    if (!canAddToDraft(text)) return false;
    ai.setMessage((current) => appendDraft(current, text));
    setView("chat");
    setChatCollapsed(false);
    if (focus) requestAnimationFrame(() => { const node = composer.current; if (node) { node.focus(); node.setSelectionRange(node.value.length, node.value.length); } });
    return true;
  }
  function answerDecision(question: string, key: string, answer: string) {
    const normalized = answer.replace(/\s+/g, " ").trim();
    if (!normalized || !addToDraft(`About “${question}”: ${normalized}`, false)) return;
    setExitingDecisions((current) => [...current, key]);
    setCustomDecision(null); setCustomAnswer("");
    exitTimers.current.push(window.setTimeout(() => setExitingDecisions((current) => current.filter((item) => item !== key)), 240));
  }
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
        {hasManagedLaunch(templateId) && <button className={styles.launchShortcut} type="button" onClick={() => document.getElementById("managed-launch")?.scrollIntoView({ behavior: "smooth" })}>Have us launch it <span aria-hidden="true">↗</span></button>}
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
    {!ai.loading && ai.state && <div ref={workspace} className={`${styles.workspace} ${chatCollapsed ? styles.workspaceCollapsed : ""}`}>
      <section className={`${styles.planPane} ${view !== "plan" ? styles.mobileHidden : ""}`} aria-label="Your project plan">
        <div className={styles.paneHeading}><div><p className={styles.kicker}>The big picture</p><h2>Your app plan</h2></div><span className={styles.version}>{project ? `v${project.revision}` : "Draft"}</span></div>
        {!brief.idea.trim() && <form className={styles.setup} onSubmit={(event) => { event.preventDefault(); if (setup.idea.trim()) setLegacyBrief(setup); }}><h3>What are you making?</h3><p>Add a brief to start this workspace.</p><label>Project name <input maxLength={100} value={setup.name} onChange={(event) => setSetup({ ...setup, name: event.target.value })} placeholder="Give your idea a name (optional)" /></label><label>Project description <textarea required maxLength={3000} rows={4} value={setup.idea} onChange={(event) => setSetup({ ...setup, idea: event.target.value })} placeholder="Who is it for, and what should it help them do?" /></label><button className={styles.primary} disabled={!setup.idea.trim()} type="submit">Save idea</button></form>}
        {plan ? <>
          <p className={styles.overview}>{plan.overview}</p>
          <div className={styles.featureHeading}><h3>What it will do</h3><span>{plan.features.length} features · Hover or tap a card</span></div>
          <div className={styles.featureGrid} role="list" aria-label={`Features for ${brief.name || "your app"}`}>{plan.features.map((feature, index) => {
            const cardId = `${project?.revision ?? 0}:${index}`, flipped = flippedFeature === cardId;
            return <article className={styles.featureTile} role="listitem" key={cardId}>
              <button className={styles.featureCard} type="button" data-flipped={flipped} data-hover-suppressed={hoverSuppressedFeature === cardId} aria-pressed={flipped} aria-label={`${feature.part}. ${feature.description} ${flipped ? "Show feature name" : "Show description"}`} onClick={() => { setFlippedFeature(flipped ? null : cardId); setHoverSuppressedFeature(flipped ? cardId : null); }} onMouseLeave={() => setHoverSuppressedFeature(null)}>
                <span className={styles.featureCardInner} aria-hidden="true">
                  <span className={`${styles.featureFace} ${styles.featureFront}`}><span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span><strong>{feature.part}</strong><span className={styles.featureHint}>View details ↗</span></span>
                  <span className={`${styles.featureFace} ${styles.featureBack}`}><span className={styles.featureBackLabel}>How it works</span><span className={styles.featureDescription}>{feature.description}</span><span className={styles.featureHint}>Tap to flip back ↶</span></span>
                </span>
              </button>
              <button className={styles.refine} type="button" disabled={pending || remaining <= 0 || !canAddToDraft(`Let’s change ${feature.part.toLowerCase()}: `)} onClick={() => addToDraft(`Let’s change ${feature.part.toLowerCase()}: `)}>Refine in chat <span aria-hidden="true">↗</span></button>
            </article>;
          })}</div>
          {technical && <details className={styles.technicalDetails}><summary>Technical details <span>{technical.notes.length} notes</span></summary><p>{technical.generated ? "Proposed implementation notes for this plan. Validate choices before building." : "Starting points based on this template. Review them against your final feature scope."}</p><ul>{technical.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
        </> : brief.idea.trim() && <div className={styles.emptyPlan}>
          <div className={styles.planSymbol} aria-hidden="true">✦</div>
          <h3>{pending ? "Turning your idea into a plan" : "Your idea is ready to take shape"}</h3>
          <p>{pending ? "AI is mapping out your overview and features. This can take a couple of minutes. Your editing messages stay untouched." : overviewUsed ? "Your previous plan was deleted. Use a remaining chat message to create a new version." : "Create your free overview to see the features your app needs."}</p>
          {pending ? <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div> : !overviewUsed && <button className={styles.primary} disabled={!ai.available || !canUseAi} onClick={() => void ai.generate("overview", brief)}>Create free overview</button>}
        </div>}
        {brief.idea.trim() && <details className={styles.originalBrief}><summary>Your original brief <span>View details</span></summary><p>{brief.idea}</p>{brief.features && <p><strong>Features & platforms</strong>{brief.features}</p>}{brief.style && <p><strong>Look & feel</strong>{brief.style}</p>}{(brief.budget || brief.decideBudget) && <p><strong>Running budget</strong>{brief.decideBudget ? "AI will recommend a starting budget" : brief.budget}</p>}</details>}
        <div className={styles.buildNext}><div><span className={styles.kicker}>When you’re ready</span><h3>Take your plan into the build.</h3><p>Get the full template and 20 editing messages with a purchase. Download this plan to keep your decisions.</p></div><Link onClick={preparePurchase} href="/templates/#bundle">Get the full template <span aria-hidden="true">↗</span></Link></div>
      </section>
      <aside className={`${styles.chatPane} ${chatCollapsed ? styles.chatPaneCollapsed : ""} ${view !== "chat" ? styles.mobileHidden : ""}`} aria-label="AI editing chat">
        <div className={styles.chatHeader}><div className={styles.aiMark} aria-hidden="true">✦</div><div><h2>Make it yours</h2><p>Chat with your AI editor</p></div><span className={styles.messageCount}>{remaining} left</span><button className={styles.collapseChat} type="button" aria-expanded={!chatCollapsed} aria-controls="trial-chat-content" onClick={() => setChatCollapsed((value) => !value)}>{chatCollapsed ? "Expand" : "Collapse"}<span aria-hidden="true">{chatCollapsed ? "⌄" : "⌃"}</span></button></div>
        <div id="trial-chat-content" className={styles.chatContent} hidden={chatCollapsed}>
        <div className={styles.composerArea}>
          {ai.error && <div className={styles.chatError}><p role="alert">{ai.error}</p><button disabled={ai.busy} onClick={() => void ai.refresh()}>Refresh conversation</button></div>}
          {!ai.available && <p className={styles.chatError}>AI editing is temporarily unavailable. Your saved plan is still here.</p>}
          {!ai.state.overviewConsent && <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Allow OpenAI to use my brief and messages to refine my plan. Chats are saved to this private link.</label>}
          {remaining === 0 ? <div className={styles.exhausted}><strong>Your trial messages are used.</strong><p>Your plan and chat are saved. Download your plan or get the full template to keep building.</p></div> : <form onSubmit={(event) => { event.preventDefault(); if (canSend && ai.message.trim()) void ai.generate("message", brief, ai.message); }}>
            <label className={styles.srOnly} htmlFor="trial-message">Ask for a change</label><textarea ref={composer} id="trial-message" rows={3} maxLength={2000} value={ai.message} disabled={pending || !ai.state} placeholder="Describe one or more changes to your app…" onChange={(event) => ai.setMessage(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing && canSend && ai.message.trim()) { event.preventDefault(); void ai.generate("message", brief, ai.message); } }} />
            <div className={styles.composerBottom}><span>{ai.message.length}/2,000</span><button className={styles.primary} type="submit" disabled={!canSend || !ai.message.trim()}>{pending ? "Working…" : "Send changes ↑"}</button></div>
          </form>}
          <p className={styles.allowance}>{remaining} of {ai.state.limit} editing messages left · Overview is free</p>
          <p className={styles.savedStatus} role="status">{ai.status}</p>
        </div>
        <div className={styles.conversation} role="log" aria-label="Conversation" aria-live="polite" tabIndex={0}>
          <div className={styles.welcome}><span className={styles.kicker}>A little help, a lot of possibility</span><h3>What would you change?</h3><p>Add a feature, simplify the scope, or change the direction. Your plan updates here as you chat.</p></div>
          {project?.history.map((item, index) => <div key={index} className={item.role === "user" ? styles.userMessage : styles.aiMessage}><strong>{item.role === "user" ? "You" : "AI editor"}</strong><p>{item.text}</p></div>)}
          {visibleDecisions.length > 0 && <section className={styles.decisionPrompts} aria-label="Decisions to make">
            <h3>Decisions to make <span>{unansweredDecisions.length} left</span></h3>
            <p>Answer a few at a time. We’ll add your choices to one message; send it when you’re ready.</p>
            <div role="list" aria-label="Decision questions">{visibleDecisions.map(({ question, key }) => <article role="listitem" className={`${styles.decisionCard} ${exitingDecisions.includes(key) ? styles.decisionExiting : ""}`} key={key}>
              <p>{question}</p>
              <div className={styles.decisionActions}>
                <button type="button" disabled={pending || remaining <= 0 || !canAddToDraft(`About “${question}”: Yes`)} onClick={() => answerDecision(question, key, "Yes")}>Yes</button>
                <button type="button" disabled={pending || remaining <= 0 || !canAddToDraft(`About “${question}”: No`)} onClick={() => answerDecision(question, key, "No")}>No</button>
                <button type="button" disabled={pending || remaining <= 0} onClick={() => { setCustomDecision(key); setCustomAnswer(""); }}>Write answer</button>
              </div>
              {customDecision === key && <form className={styles.customAnswer} onSubmit={(event) => { event.preventDefault(); answerDecision(question, key, customAnswer); }}>
                <label htmlFor={`decision-answer-${key}`}>Your answer</label>
                <textarea id={`decision-answer-${key}`} maxLength={300} rows={2} value={customAnswer} onChange={(event) => setCustomAnswer(event.target.value)} placeholder="Type a short answer…" autoFocus />
                <div><button type="submit" disabled={!customAnswer.trim() || !canAddToDraft(`About “${question}”: ${customAnswer.replace(/\s+/g, " ").trim()}`)}>Add answer</button><button type="button" onClick={() => setCustomDecision(null)}>Cancel</button></div>
              </form>}
            </article>)}</div>
          </section>}
          {pending && <div className={styles.thinking} role="status"><span aria-hidden="true">✦</span> {project ? "Updating your plan…" : "Preparing your free overview…"}</div>}
          {!pending && !project?.history.some((item) => item.role === "user") && <div className={styles.suggestions}>{quickPrompts.map(({ label, message }) => <button key={label} disabled={!canSend || !canAddToDraft(message)} onClick={() => addToDraft(message)}>{label}<span aria-hidden="true">{ai.message.includes(message) ? "Added ✓" : "Add +"}</span></button>)}</div>}
        </div>
        </div>
      </aside>
    </div>}
    {hasManagedLaunch(templateId) && <ManagedLaunch templateId={templateId} projectName={brief.name} />}
    <div className={styles.downloadFooter}><button className={styles.downloadPlan} disabled={!project} onClick={exportPlan}>Download plan <span aria-hidden="true">↓</span></button></div>
    <footer className={styles.workspaceFooter}><p>AI helps shape your plan. Building the app happens in your coding tool.</p><details><summary>Manage saved content</summary><p>Delete the saved brief, plan, and conversation. This does not reset your message allowance.</p>{confirmDelete ? <div><button disabled={pending} onClick={async () => { await ai.clear(); setLegacyBrief(emptyPersonalization); setSetup(emptyPersonalization); setConsent(false); setConfirmDelete(false); }}>Confirm delete</button><button onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button disabled={pending || !ai.state} onClick={() => setConfirmDelete(true)}>Delete saved content</button>}</details></footer>
  </div>;
}
