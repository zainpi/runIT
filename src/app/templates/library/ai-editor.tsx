"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TRIAL_MESSAGE_LIMIT } from "@/lib/templates/trial-contract";
import { sameBrief, type AppPlan, type AiProject, type AiSnapshot } from "@/lib/templates/ai-contract";
import type { TemplateId } from "@/lib/templates/catalog";
import type { Personalization } from "@/lib/templates/compose";
import { PlanOverview } from "../plan-overview";
import { BuildFileMap } from "./build-file-map";
import type { Receipt } from "../browser-storage";
import styles from "./ai-editor.module.css";
import dashboard from "../trial/dashboard.module.css";
import shared from "../templates.module.css";

const decideForMe = "Decide for me. Recommend the simplest practical option for my app and explain why.";
function hasDecisionAnswer(message: string, question: string) {
  const prefix = `About “${question}”: `;
  return message.split("\n").some((line) => line.startsWith(prefix) && !!line.slice(prefix.length).trim());
}

const workspaceTabs = [
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build files" },
  { id: "addons", label: "Add-ons" },
] as const;
export type WorkspaceTab = typeof workspaceTabs[number]["id"];

type Props = {
  receipt: Pick<Receipt, "sessionId" | "accessToken">; trial?: boolean; templateId: TemplateId; details: Personalization;
  briefEditor: ReactNode; buildFiles: ReactNode; addons: ReactNode;
  purchasedAddons: { subagents: boolean; skillTree: boolean; appIcon: boolean };
  activeTab: WorkspaceTab; onTabChange(tab: WorkspaceTab): void;
  onApplied(plan: AppPlan | null, brief: Personalization | null): void;
  onRestoreBrief(brief: Personalization): void;
  onCleared(): void;
  onProject?(project: AiProject | null): void;
};
export function AiEditor({ receipt, templateId, details, onApplied, onRestoreBrief, onCleared, onProject, briefEditor, buildFiles, addons, purchasedAddons, activeTab, onTabChange, trial = false }: Props) {
  const [state, setState] = useState<AiSnapshot | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [view, setView] = useState<"plan" | "chat">("plan");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [customQuestion, setCustomQuestion] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const choicesTried = useRef<string | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => { setView("plan"); }, [activeTab]);
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
    }).catch(() => { if (!cancelled) setError(trial ? "AI editing could not be loaded. Keep your trial link and refresh to try again." : "AI editing could not be loaded. Your template is still available in Build files."); }).finally(() => { if (!cancelled) setLoading(false); });
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

  async function act(action: "overview" | "message" | "guide" | "choices" | "apply" | "load" | "clear") {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    const generate = action === "overview" || action === "message" || action === "guide" || action === "choices";
    const body = { action, revision: project?.revision ?? 0, ...(generate ? { brief: action === "choices" ? project?.brief : details, message: action === "choices" ? "" : message, consent } : {}) };
    const fingerprint = JSON.stringify(body);
    if (generate && pending.current?.fingerprint !== fingerprint) pending.current = { requestId: crypto.randomUUID(), fingerprint };
    try {
      const result = await request({ ...body, ...(generate ? { requestId: pending.current?.requestId } : {}) });
      if (!alive.current) return;
      accept(result); pending.current = null;
      if (action === "choices") setNotice("Example answers added to your saved questions.");
      if (generate && action !== "guide" && action !== "choices") { setMessage(""); setNotice(trial ? "Your plan is ready to review. Send a message to refine it, or download a copy." : "Your plan is ready to review. Apply it when you’re happy with it."); }
      if (action === "guide") setNotice("Guide requested. It is saved to this purchase when ready; you can safely return using your private link.");
      if (action === "apply") setNotice("Your plan is ready in Build files and saved to this purchase.");
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
          if (action === "choices" && recovered?.plan.questionChoices?.length === recovered?.plan.questions.length) { setError(""); setNotice("Example answers added to your saved questions."); }
          if (generate && action !== "guide" && action !== "choices" && recovered && recovered.revision > body.revision && sameBrief(recovered.brief, details) && (action === "overview" || recovered.history.some((entry, index) => index === recovered.history.length - 2 && entry.role === "user" && entry.text === message.trim()))) {
            setMessage(""); setError(""); setNotice("Your response was saved. Review the updated plan below.");
          }
          pending.current = null;
        }
      } catch { /* Keep the request ID for a safe retry. */ }
    } finally { sending.current = false; if (alive.current) { setBusy(false); setLoading(false); } }
  }
  const locked = loading || busy || !!state?.pending;
  const remaining = state?.remaining ?? allowance;
  const canSend = !locked && available && consent && !!details.idea.trim() && remaining > 0 && (!!project || !freeOverview);
  const unansweredQuestions = project?.plan.questions.filter((question) => !hasDecisionAnswer(message, question) && !project.history.some((entry) => entry.role === "user" && hasDecisionAnswer(entry.text, question))) ?? [];
  const missingChoices = !!project?.plan.questions.length && project.plan.questionChoices?.length !== project.plan.questions.length;
  const appSettings = <details key={project ? "saved" : "draft"} className={styles.appSettings} open={!project}>
    <summary>App details &amp; build mode <span>{project ? "Edit details" : "Add your idea"}</span></summary>
    <p>Describe your idea and choose how you want to build. Your edits are saved in this browser.</p>
    {briefEditor}
  </details>;
  useEffect(() => {
    if (!project || !missingChoices || !available || !consent || locked) return;
    const key = `${templateId}:${project.revision}`;
    if (choicesTried.current === key) return;
    choicesTried.current = key;
    void act("choices");
    // act uses the current project and consent, and is intentionally started once per revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, missingChoices, available, consent, locked, templateId]);
  function draftWith(text: string) { return message.includes(text) ? message : `${message}${message ? "\n\n" : ""}${text}`; }
  function addToDraft(text: string) {
    const next = draftWith(text);
    if (next.length > 2000) return;
    setMessage(next); setView("chat"); setChatCollapsed(false);
    requestAnimationFrame(() => { composer.current?.focus(); composer.current?.setSelectionRange(next.length, next.length); });
  }
  function answerQuestion(question: string, answer: string) {
    const normalized = answer.replace(/\s+/g, " ").trim();
    if (!normalized || locked || remaining === 0) return;
    addToDraft(`About “${question}”: ${normalized}`);
    setCustomQuestion(null); setCustomAnswer("");
  }
  function switchView(next: "plan" | "chat") {
    setView(next);
    if (next === "chat") setChatCollapsed(false);
    requestAnimationFrame(() => workspace.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  function selectTab(tab: WorkspaceTab) { onTabChange(tab); setView("plan"); }
  return <section className={styles.editor} aria-label="Shape your app with AI" aria-busy={busy || loading}>
    <div className={dashboard.projectMeta}><span><i aria-hidden="true" />{locked ? "Preparing your workspace" : project ? "Plan saved" : "Workspace ready"}</span><span>{project ? `${project.plan.features.length} features` : "Free overview included"}</span><span>{project ? `Version ${project.revision}` : "Personalized feature plan"}</span><span className={dashboard.checkoutStatus}>Full template · {allowance} editing messages included</span></div>
    <div className={dashboard.mobileSwitch} role="group" aria-label="Dashboard view"><button aria-pressed={view === "plan"} onClick={() => switchView("plan")}>Workspace</button><button aria-pressed={view === "chat"} onClick={() => switchView("chat")}>AI chat · {remaining} left</button></div>
    {error && view === "plan" && <div className={dashboard.mobileError}><p role="alert">{error}</p><button disabled={locked} onClick={() => void act("load")}>Refresh conversation</button></div>}
    <div className={styles.tabs} role="tablist" aria-label="Project sections">{workspaceTabs.map((tab, index) => <button key={tab.id} id={`workspace-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`workspace-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={(event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % workspaceTabs.length : event.key === "ArrowLeft" ? (index + workspaceTabs.length - 1) % workspaceTabs.length : event.key === "Home" ? 0 : event.key === "End" ? workspaceTabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); selectTab(workspaceTabs[next].id); document.getElementById(`workspace-tab-${workspaceTabs[next].id}`)?.focus();
    }}>{tab.label}</button>)}</div>
    <div ref={workspace} className={`${dashboard.workspace} ${styles.workspaceLayout} ${chatCollapsed ? styles.workspaceCollapsed : ""}`}>
      <div className={`${styles.mainPane} ${view !== "plan" ? dashboard.mobileHidden : ""}`}>
      <section id="workspace-panel-plan" role="tabpanel" aria-labelledby="workspace-tab-plan" tabIndex={0} hidden={activeTab !== "plan"} className={`${dashboard.planPane} ${styles.tabPanel}`}>
        <div className={dashboard.paneHeading}><div><p className={dashboard.kicker}>The big picture</p><h2>Your app plan</h2></div><span className={dashboard.version}>{project ? `v${project.revision}` : "Draft"}</span></div>
        {!project && appSettings}
        {project ? <PlanOverview plan={project.plan} templateId={templateId} name={project.brief.name} revision={project.revision} canRefine={(text) => !locked && remaining > 0 && draftWith(text).length <= 2000} onRefine={addToDraft} /> : <div className={dashboard.emptyPlan}>
          <div className={dashboard.planSymbol} aria-hidden="true">✦</div>
          <h3>{locked ? "Turning your idea into a plan" : "Your idea is ready to take shape"}</h3>
          <p>{loading ? "Opening your saved workspace…" : state?.pending ? "AI is mapping out your overview and features. Your editing messages stay untouched." : !details.idea.trim() ? "Add your idea above, then create a free overview to see what your app will do." : freeOverview ? "Create your free overview to see the features your app needs." : "Your previous plan was deleted. Use a remaining chat message to create a new version."}</p>
          {locked ? <div className={dashboard.skeleton} aria-hidden="true"><span /><span /><span /></div> : freeOverview && <><button className={dashboard.primary} disabled={!available || !consent || !details.idea.trim()} onClick={() => void act("overview")}>Create my free overview</button><label className={`${dashboard.consent} ${styles.overviewConsent}`}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Allow sending my app details and messages to OpenAI to tailor my prompt.</label></>}
        </div>}
        {project && appSettings}
        {stale && <p className={shared.notice}>Your app details differ from this saved overview. Send a message to update the plan, or <button className={styles.textButton} disabled={locked} onClick={() => callbacks.current.onRestoreBrief(project!.brief)}>restore the saved details</button>.</p>}
        {project && <div className={dashboard.buildNext}>
          <p className={dashboard.kicker}>When you’re ready</p><h3>Take your plan into the build.</h3>
          <p>Use this plan to update your downloadable build prompt, or create a complete build guide with setup steps, tests, and an HTML prototype.</p>
          {!trial && <div className={styles.actions}><button className={dashboard.primary} disabled={locked || stale || project.appliedRevision === project.revision} onClick={() => void act("apply")}>{stale ? "Update your plan first" : project.appliedRevision === project.revision ? "Plan added to build files" : "Use this plan"}</button></div>}
          <button className={styles.textButton} onClick={() => selectTab("build")}>Open build files →</button>
        </div>}
      </section>
      <section id="workspace-panel-build" role="tabpanel" aria-labelledby="workspace-tab-build" tabIndex={0} hidden={activeTab !== "build"} className={styles.tabPanel}>
        <div className={dashboard.planPane}>
          <div className={dashboard.paneHeading}><div><p className={dashboard.kicker}>From idea to app</p><h2>Your build files</h2></div></div>
          <p className={styles.hint}>Your full prompt is ready to download. Create a complete guide from your reviewed plan for setup steps, tests, and an HTML prototype.</p>
          <BuildFileMap templateId={templateId} appName={details.name} guideName={project?.guide?.brief.name} hasPlan={!!project} {...purchasedAddons} onOpenAddons={() => selectTab("addons")} />
          {project ? <>
          {!trial && <div className={styles.guideAction}><p>Your first successful guide for each template is included. Regenerating uses one editing message. Failed attempts do not use a message.</p><button className={dashboard.primary} disabled={locked || !available || !consent || stale || (!!state?.guideUsed?.includes(templateId) && remaining === 0)} onClick={() => void act("guide")}>{state?.guideUsed?.includes(templateId) ? "Regenerate build guide · 1 message" : "Create my complete build guide"}</button>{!consent && <p><button className={styles.textButton} onClick={() => switchView("chat")}>Enable OpenAI in AI chat</button> to create your guide.</p>}</div>}
            {stale && <p className={styles.hint}>Your app details have changed. Update the plan in chat before generating a new guide.</p>}
          </> : <button className={styles.textButton} onClick={() => selectTab("plan")}>Create your plan to unlock guide generation →</button>}
          {state?.guideError && <p role="alert" className={shared.notice}>{state.guideError}</p>}
          {state?.pending && <p className={styles.hint} role="status">{state.pendingKind === "guide" ? "Your complete guide is being prepared. This page checks automatically. You can leave and reopen your private purchase link." : `A response is being prepared for this ${accessLabel}. This page checks automatically.`}</p>}
        </div>
        {buildFiles}
      </section>
      <section id="workspace-panel-addons" role="tabpanel" aria-labelledby="workspace-tab-addons" tabIndex={0} hidden={activeTab !== "addons"} className={styles.tabPanel}>{addons}</section>
      </div>
      <aside className={`${dashboard.chatPane} ${styles.chatSidebar} ${chatCollapsed ? dashboard.chatPaneCollapsed : ""} ${view !== "chat" ? dashboard.mobileHidden : ""}`} aria-label="AI editing chat">
        <div className={dashboard.chatHeader}><div className={dashboard.aiMark} aria-hidden="true">✦</div><div><h2>Make it yours</h2><p>Chat with your AI editor</p></div><span className={dashboard.messageCount}>{remaining} left</span><button className={dashboard.collapseChat} type="button" aria-expanded={!chatCollapsed} aria-controls="purchase-chat-content" onClick={() => setChatCollapsed((value) => !value)}>{chatCollapsed ? "Expand" : "Collapse"}<span aria-hidden="true">{chatCollapsed ? "⌄" : "⌃"}</span></button></div>
        <div id="purchase-chat-content" className={`${dashboard.chatContent} ${styles.chatBody}`} hidden={chatCollapsed}>
          <div className={dashboard.composerArea}>
            {error && <div className={dashboard.chatError}><p role="alert">{error}</p></div>}
            {!loading && !available && <p className={dashboard.chatError}>AI editing is currently unavailable. Your saved plan and full template are still accessible.</p>}
            <label className={dashboard.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Send my app details and messages to OpenAI to tailor my prompt.</label>
            <form onSubmit={(event) => { event.preventDefault(); if (canSend && message.trim()) void act("message"); }}>
              <label className={dashboard.srOnly} htmlFor="ai-message">What would you like to change?</label><textarea ref={composer} id="ai-message" value={message} maxLength={2000} rows={3} onChange={(event) => setMessage(event.target.value)} placeholder="Describe one or more changes to your app…" disabled={locked || !available || remaining === 0} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing && canSend && message.trim()) { event.preventDefault(); void act("message"); } }} />
              <div className={dashboard.composerBottom}><span>{message.length}/2,000</span><button className={dashboard.primary} type="submit" disabled={!canSend || !message.trim()}>{busy ? "Working…" : "Send message"}</button></div>
            </form>
            {!project && freeOverview && <p className={dashboard.allowance}>Create your free overview in the Plan tab before sending changes.</p>}
            <p className={dashboard.allowance}>{remaining} of {state?.limit ?? allowance} messages left · Overview is free</p>
            {remaining === 0 && <div className={dashboard.exhausted}><p>You’ve used all {allowance} messages. Your saved plan, chat, and prompt remain available to read, apply and download.</p></div>}
            <p role="status" aria-live="polite" className={dashboard.savedStatus}>{busy ? "Working on your request…" : notice}</p>
            <button className={styles.textButton} disabled={busy || loading} onClick={() => void act("load")}>Refresh conversation</button>
          </div>
          {!!unansweredQuestions.length && <section className={`${dashboard.decisionPrompts} ${styles.decisionShelf}`} aria-label="Decisions to make">
            <h3>Decisions to make <span>{unansweredQuestions.length} left</span></h3>
            <p>Choose an AI suggested answer, write your own, or let AI recommend one. Your answers will be added to the message above.</p>
            {missingChoices && !consent && <p>Enable OpenAI above to generate example answers for this saved plan.</p>}
            {missingChoices && consent && error && !locked && <button className={styles.textButton} type="button" onClick={() => void act("choices")}>Retry example answers</button>}
            <div role="list" aria-label="Decision questions">{unansweredQuestions.slice(0, 3).map((question) => {
              const options = project?.plan.questionChoices?.find((choice) => choice.question === question)?.options;
              const canAnswer = !locked && remaining > 0 && draftWith(`About “${question}”: ${decideForMe}`).length <= 2000;
              return <article role="listitem" className={dashboard.decisionCard} key={question}>
                <p id={`paid-question-${project?.plan.questions.indexOf(question)}`}>{question}</p>
                <div className={dashboard.decisionActions} data-has-choices={!!options} role="group" aria-labelledby={`paid-question-${project?.plan.questions.indexOf(question)}`}>
                  {options?.length === 2 ? options.map((answer) => <button key={answer} type="button" disabled={!canAnswer || draftWith(`About “${question}”: ${answer}`).length > 2000} onClick={() => answerQuestion(question, answer)}>{answer}</button>) : <button type="button" disabled={!canAnswer} onClick={() => { setCustomQuestion(question); setCustomAnswer(""); }}>Write my answer</button>}
                  <button className={dashboard.decideForMe} type="button" aria-label="Decide for me" title="Decide for me" disabled={!canAnswer} onClick={() => answerQuestion(question, decideForMe)}>✦</button>
                </div>
                {options?.length === 2 && <button className={dashboard.writeAnswer} type="button" disabled={!canAnswer} onClick={() => { setCustomQuestion(question); setCustomAnswer(""); }}>Write my own answer</button>}
                {customQuestion === question && <form className={dashboard.customAnswer} onSubmit={(event) => { event.preventDefault(); answerQuestion(question, customAnswer); }}>
                  <label htmlFor={`paid-answer-${project?.plan.questions.indexOf(question)}`}>Your answer</label>
                  <textarea id={`paid-answer-${project?.plan.questions.indexOf(question)}`} maxLength={300} rows={2} disabled={!canAnswer} value={customAnswer} onChange={(event) => setCustomAnswer(event.target.value)} placeholder="Type a short answer…" autoFocus />
                  <div><button type="submit" disabled={!canAnswer || !customAnswer.trim() || draftWith(`About “${question}”: ${customAnswer}`).length > 2000}>Add answer</button><button type="button" onClick={() => setCustomQuestion(null)}>Cancel</button></div>
                </form>}
              </article>;
            })}</div>
          </section>}
          <div className={`${dashboard.conversation} ${styles.chatLog}`} role="log" aria-label="Conversation" aria-live="polite" tabIndex={0}>
            <div className={dashboard.welcome}><span className={dashboard.kicker}>A little help, a lot of possibility</span><h3>What would you change?</h3><p>Add a feature, simplify the scope, or change the direction. Your {allowance} editing messages are shared across the templates in this {accessLabel}.</p></div>
            {project?.history.map((entry, index) => <div key={index} className={entry.role === "user" ? dashboard.userMessage : dashboard.aiMessage}><strong>{entry.role === "user" ? "You" : "AI editor"}</strong><p>{entry.text}</p></div>)}
            {locked && <div className={dashboard.thinking} role="status"><span aria-hidden="true">✦</span>{loading ? "Opening your workspace…" : state?.pendingKind === "guide" ? "Preparing your build guide…" : "Updating your plan…"}</div>}
          </div>
        </div>
      </aside>
    </div>
    <footer className={dashboard.workspaceFooter}><p>AI helps shape your plan. Building the app happens in your coding tool.</p><details><summary>Manage saved content</summary><p>Your AI brief, plan, chat and guide are saved to this private {accessLabel} link. Anyone with it can read or edit them and use the allowance. Do not include passwords, API keys or private customer data. Deletion does not reset usage.</p>{state && Object.keys(state.projects).length > 0 && <button disabled={locked} onClick={() => setConfirmClear(true)}>Delete saved AI content</button>}{confirmClear && <div><p>Delete all saved AI briefs, plans, conversations and build guides for this {accessLabel}? Download anything you want to keep first.</p><button disabled={locked} onClick={() => setConfirmClear(false)}>Keep content</button><button disabled={locked} onClick={() => void act("clear")}>Delete content for this {accessLabel}</button></div>}</details></footer>
  </section>;
}
