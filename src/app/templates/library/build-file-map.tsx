import type { TemplateId } from "@/lib/templates/catalog";
import { buildGuideFileName } from "./build-guide";
import styles from "./ai-editor.module.css";

type Props = {
  templateId: TemplateId;
  appName: string;
  guideName?: string;
  hasPlan: boolean;
  subagents: boolean;
  skillTree: boolean;
  appIcon: boolean;
  onOpenAddons(): void;
};

export function BuildFileMap({ templateId, appName, guideName, hasPlan, subagents, skillTree, appIcon, onOpenAddons }: Props) {
  const guideFile = buildGuideFileName(guideName ?? appName);
  const hasAddons = subagents || skillTree || appIcon;
  return <section className={styles.fileMap} aria-labelledby="build-file-map-heading">
    <div className={styles.fileMapHeading}>
      <div><p className={styles.fileMapEyebrow}>What you get</p><h3 id="build-file-map-heading">Files &amp; setup</h3></div>
      <span className={styles.fileMapBadge}>Individual downloads</span>
    </div>
    <div className={styles.fileMapGrid}>
      <div>
        <h4>Downloads from this page</h4>
        <p className={styles.fileMapNote}>Save these files together if you want a local copy.</p>
        <div className={styles.fileTree} role="group" aria-label="Download file structure">
          <div className={styles.treeRoot}><span aria-hidden="true">▾</span> downloads/</div>
          <ul>
            <li><code>{templateId}-prompt.txt</code><span>Ready now · your brief and full coding instructions</span></li>
            <li><code>{guideFile}</code><span>{guideName ? "Ready below · setup guide, checks, and clickable prototype" : hasPlan ? "Create below · setup guide, checks, and clickable prototype" : "Create a plan, then generate the guide below"}</span></li>
            {subagents && <li><code>subagent-workflow.txt</code><span>In Add-ons · lead AI and coding agent workflow</span></li>}
            {skillTree && <li><code>skill-tree-setup-prompt.txt</code><span>In Add-ons · prepare your AI workspace first</span></li>}
            {appIcon && <li><code>*.png</code><span>In Add-ons · icon versions after you create them</span></li>}
          </ul>
        </div>
        {hasAddons && <button className={styles.fileMapLink} type="button" onClick={onOpenAddons}>Open purchased add-ons ↗</button>}
      </div>
      <div>
        <h4>How to use them</h4>
        <ol className={styles.setupSteps}>
          <li><span>01</span><p>Review your app details and plan. Copy or download the <strong>prompt</strong>.</p></li>
          <li><span>02</span><p>Paste the prompt into your coding AI. If you bought skill tree setup, run that setup prompt first.</p></li>
          <li><span>03</span><p>Generate the <strong>HTML guide</strong> for setup steps, checks, and a sample prototype. Open it in a browser.</p></li>
        </ol>
        <p className={styles.fileMapNote}>The prompt and guide are instructions and a prototype. Use the prompt with your coding AI to build the actual app files.</p>
      </div>
    </div>
    <div className={styles.projectTree}>
      <div><h4>Project files requested in your prompt</h4><p>Example structure; source folders vary by template and platform. Your coding AI creates these during the build; they are not included in the downloads above.</p></div>
      <ul aria-label="Example generated project structure">
        <li><code>your-project/</code><span>Project root</span></li>
        <li><code>├─ src/ or app/</code><span>Application source</span></li>
        <li><code>├─ tests/</code><span>Core workflow checks</span></li>
        <li><code>├─ README.md</code><span>Overview and run commands</span></li>
        <li><code>├─ SETUP.md</code><span>Step-by-step local setup</span></li>
        <li><code>├─ SERVICES.md</code><span>External accounts and credentials</span></li>
        <li><code>├─ OPERATIONS.md</code><span>Launch and maintenance</span></li>
        <li><code>└─ FOLLOW_UP_PROMPTS.md</code><span>Useful next prompts</span></li>
      </ul>
    </div>
  </section>;
}
