"use client";
import { modeInstructions, type Personalization } from "@/lib/templates/compose";
import type { BuildMode } from "@/lib/templates/catalog";
import styles from "./templates.module.css";

export function Personalize({ details, mode, onDetails, onMode, compact = false, previewOnly = false, previewPurchaseHref = "#bundle" }: { details: Personalization; mode: BuildMode; onDetails: (value: Personalization) => void; onMode: (value: BuildMode) => void; compact?: boolean; previewOnly?: boolean; previewPurchaseHref?: string }) {
  const buildSettings = <div>{!compact && <><p className={styles.eyebrow}>02 / Make it yours</p><h2>Same foundation.<br />Your own idea.</h2><p className={styles.muted}>Describe your idea in your own words. No technical plan needed. Fill this in now or after buying, and change it whenever you like. Your draft is saved in this browser. Using AI also saves your brief and chat to your private link.</p></>}
      <fieldset className={styles.mode}><legend>How do you want to build?</legend>
        <label data-selected={mode === "computer"}><input type="radio" name="mode" value="computer" checked={mode === "computer"} onChange={() => onMode("computer")} /><strong>Make AI control my computer</strong><span>Your AI uses its available tools to write the code and explains what it is doing. You approve sensitive steps.</span></label>
        <label data-selected={mode === "manual"}><input type="radio" name="mode" value="manual" checked={mode === "manual"} onChange={() => onMode("manual")} /><strong>Do it myself</strong><span>Follow simple steps with links, ready-to-copy code and checks. You don’t need to write code from scratch.</span></label>
      </fieldset>
      <p className={styles.small}>Computer control requires an AI tool that supports it. This website gives you the prompt; it does not control your device.</p>
      <aside id="model-guide" className={styles.modelGuide} aria-labelledby="model-guide-heading">
        <p className={styles.eyebrow}>Our recommended setup</p>
        <h3 id="model-guide-heading">Works best with GPT-6 Astra</h3>
        <p>Start with <strong>High thinking</strong> for your first build. It is our recommended starting point for planning how your app fits together, writing its code and checking the result.</p>
        <details><summary>Which thinking level should I use?</summary>
          <p>The thinking level controls how much effort the AI spends working through a task.</p>
          <ul>
            <li><strong>High — start here.</strong> Use it for the initial build, connecting services, and reviewing payments or account security.</li>
            <li><strong>Medium — everyday edits.</strong> Use it for small layout changes, new text and straightforward follow-ups.</li>
            <li><strong>Extra High or Max — difficult problems.</strong> Try a higher level for stubborn bugs or complicated changes that need deeper investigation.</li>
          </ul>
          <p>Higher levels can take longer and use more tokens, which may use more of your AI allowance or API budget. Start with High and adjust to the task.</p>
          <p>Before pasting your prompt, choose GPT-6 Astra and the thinking or reasoning level in your AI tool. Use the options available on your account; the prompt itself does not change these settings. AI access is purchased separately.</p>
          <p className={styles.small}>Learn more in the official OpenAI documentation: <a href="https://developers.openai.com/api/docs/models/gpt-6-astra" target="_blank" rel="noopener noreferrer">GPT-6 Astra</a> and <a href="https://learn.chatgpt.com/docs/agent-configuration/subagents#choosing-models-and-reasoning" target="_blank" rel="noopener noreferrer">thinking levels</a>.</p>
        </details>
      </aside>
    </div>;
  const fields = <div className={styles.fields}>
      <label>App name <span>optional</span><input maxLength={100} value={details.name} onChange={(e) => onDetails({ ...details, name: e.target.value })} placeholder="Give your idea a name" /></label>
      <label className={styles.longField}>What do you want to make?<textarea id="template-idea" maxLength={3000} rows={4} value={details.idea} onChange={(e) => onDetails({ ...details, idea: e.target.value })} placeholder="Who is it for? What should it help them do?" /></label>
      <label className={styles.longField}>Features & platforms<textarea maxLength={3000} rows={3} value={details.features} onChange={(e) => onDetails({ ...details, features: e.target.value })} placeholder="Must-haves, changes, iOS or Android, optional services…" /></label>
      <div className={styles.fieldPair}>
        <label>Look & feel<input maxLength={500} value={details.style} onChange={(e) => onDetails({ ...details, style: e.target.value })} placeholder="Minimal, playful, cozy…" /></label>
        <div>
          <label>Running budget<input maxLength={200} value={details.decideBudget ? "" : details.budget} disabled={details.decideBudget === true} onChange={(e) => onDetails({ ...details, budget: e.target.value })} placeholder={details.decideBudget ? "AI will recommend a budget" : "$20/month, 100 users"} /></label>
          <label className={styles.budgetChoice}><input type="checkbox" checked={details.decideBudget === true} onChange={(e) => onDetails({ ...details, decideBudget: e.target.checked })} />Decide for me</label>
          {details.decideBudget && <p className={styles.budgetHint}>Your AI will recommend a starting budget and explain the costs.</p>}
        </div>
      </div>
      <details className={styles.modePreview}><summary>Read the {mode === "manual" ? "manual" : "computer control"} instructions</summary>
        {previewOnly ? <div className={styles.lockedModePreview}>
          <pre>{modeInstructions[mode].split("\n").slice(0, 2).join("\n")}</pre>
          <div className={styles.modePreviewBlur} aria-hidden="true"><pre>Your full template continues with detailed workspace setup, service connections, implementation steps, verification checks, deployment instructions and a maintenance plan for your chosen foundation.</pre></div>
          <a className={styles.modePreviewUnlock} href={previewPurchaseHref}>Purchase to see full template <span aria-hidden="true">→</span></a>
        </div> : <pre>{modeInstructions[mode]}</pre>}
      </details>
    </div>;
  return <div className={`${styles.personalize} ${compact ? styles.compactPersonalize : ""}`}>{compact ? <>{fields}{buildSettings}</> : <>{buildSettings}{fields}</>}</div>;
}
