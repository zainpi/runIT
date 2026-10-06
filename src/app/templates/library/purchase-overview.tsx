"use client";
import Image from "next/image";
import { useState } from "react";
import type { AiProject } from "@/lib/templates/ai-contract";
import type { BuildMode, TemplateId } from "@/lib/templates/catalog";
import { composePrompt, type Personalization } from "@/lib/templates/compose";
import { buildGuideHtml } from "@/lib/templates/guide-html";
import type { IconSnapshot } from "@/lib/templates/icon-contract";
import { createZip, type ZipEntry } from "@/lib/templates/zip";
import type { Receipt } from "../browser-storage";
import { hasManagedLaunch } from "../managed-launch";
import { buildGuideFileName } from "./build-guide";
import type { WorkspaceTab } from "./ai-editor";
import shared from "../templates.module.css";
import dashboard from "../trial/dashboard.module.css";
import styles from "./purchase-overview.module.css";

type Props = {
  receipt: Pick<Receipt, "sessionId" | "accessToken" | "createdAt">;
  templateId: TemplateId; title: string; foundation: string; details: Personalization; mode: BuildMode;
  prompt: string; setupPrompt: string; subagents?: string; skillTree?: string;
  appIcon: boolean; icon: IconSnapshot | null; project?: AiProject; accessFile: string;
  onOpenTab(tab: WorkspaceTab): void; onCopy(text: string, message: string): void; onStatus(message: string): void;
};

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}
function decodeBase64(value: string) {
  const binary = atob(value), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function PurchaseOverview({ receipt, templateId, title, foundation, details, mode, prompt, setupPrompt, subagents, skillTree, appIcon, icon, project, accessFile, onOpenTab, onCopy, onStatus }: Props) {
  const [busy, setBusy] = useState(false);
  const name = details.name.trim() || "Your new project";
  const image = icon?.image;
  const guide = project?.guide;
  const iconVersions = icon?.versions ?? [];
  const purchasedOn = /^\d{4}-\d{2}-\d{2}/.test(receipt.createdAt) ? new Date(receipt.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

  async function iconFiles(): Promise<ZipEntry[]> {
    if (!appIcon || !iconVersions.length) return [];
    const files: ZipEntry[] = [];
    for (const version of iconVersions) {
      let base64 = image?.id === version.id ? image.base64 : "";
      if (!base64) {
        const response = await fetch("/api/templates/icon/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", sessionId: receipt.sessionId, accessToken: receipt.accessToken, versionId: version.id }) });
        if (!response.ok) throw new Error("Your app icons could not be added. Try again in a moment.");
        base64 = (await response.json()).state?.image?.base64 ?? "";
      }
      if (base64) files.push({ name: `app-icon/app-icon-v${version.number}.png`, data: decodeBase64(base64) });
    }
    return files;
  }

  async function downloadAll() {
    setBusy(true); onStatus("Preparing your files…");
    try {
      const files: ZipEntry[] = [{ name: `${templateId}-prompt.txt`, data: prompt }];
      if (skillTree) files.push({ name: "skill-tree-setup-prompt.txt", data: setupPrompt });
      if (subagents) files.push({ name: "subagent-workflow.txt", data: subagents });
      if (guide) files.push({ name: buildGuideFileName(guide.brief.name), data: buildGuideHtml(guide, composePrompt(title, foundation, guide.brief, mode, subagents, skillTree, guide.plan, guide)) });
      files.push(...await iconFiles());
      files.push({ name: "template-order-access.txt", data: accessFile });
      const url = URL.createObjectURL(new Blob([createZip(files)], { type: "application/zip" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${slug(details.name) || templateId}-files.zip`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onStatus(`Downloaded ${files.length} ${files.length === 1 ? "file" : "files"} in one .zip.`);
    } catch (cause) {
      onStatus(cause instanceof Error ? cause.message : "Your files could not be bundled. Try again in a moment.");
    } finally { setBusy(false); }
  }

  const included: { label: string; detail: string; ready: boolean; optional?: boolean; tab: WorkspaceTab; action: string }[] = [
    { label: "Full template prompt", detail: `${title} foundation, personalized with your app details`, ready: true, tab: "build", action: "Open build files" },
    { label: "App plan", detail: project ? `Version ${project.revision} · ${project.plan.features.length} features` : "Not created yet · your first one is free", ready: !!project, tab: "plan", action: project ? "View plan" : "Create plan" },
    { label: "Complete build guide", detail: guide ? `HTML guide and prototype from plan version ${guide.sourceRevision}` : "Create it from your plan", ready: !!guide, tab: "build", action: guide ? "View guide" : "Create guide" },
    ...(appIcon ? [{ label: "App icon", detail: iconVersions.length ? `${iconVersions.length} ${iconVersions.length === 1 ? "version" : "versions"} · ${icon?.updatesRemaining ?? 0} updates left` : icon?.status === "pending" ? "Being created" : "Not created yet", ready: iconVersions.length > 0, tab: "addons" as const, action: iconVersions.length ? "Manage icon" : "Create icon" }] : []),
    ...(subagents ? [{ label: "Subagent workflow", detail: "Included in your build prompt", ready: true, tab: "addons" as const, action: "Open add-on" }] : []),
    ...(skillTree ? [{ label: "Skill tree setup", detail: "Setup prompt and build instructions", ready: true, tab: "addons" as const, action: "Open add-on" }] : []),
    ...(hasManagedLaunch(templateId) ? [{ label: "Managed launch", detail: "Optional: have us publish it for you", ready: false, optional: true, tab: "addons" as const, action: "Learn more" }] : []),
  ];

  return <div className={styles.overview}>
    <section className={styles.hero} aria-labelledby="overview-heading">
      <div className={styles.icon}>
        {image ? <Image src={`data:image/png;base64,${image.base64}`} alt={`${name} app icon, version ${image.number}`} width={1024} height={1024} unoptimized />
          : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className={styles.heroText}>
        <p className={dashboard.kicker}>{title}{purchasedOn ? ` · Purchased ${purchasedOn}` : ""}</p>
        <h2 id="overview-heading">{name}</h2>
        <p>{details.idea.trim() || "Add your idea in the Plan tab to personalize every file in this purchase."}</p>
        <div className={styles.heroActions}>
          <button className={shared.primary} type="button" disabled={busy} onClick={() => void downloadAll()}>{busy ? "Preparing…" : "Download all"} <span aria-hidden="true">↓</span></button>
          <span className={shared.small}>Prompt{skillTree || subagents ? ", add-ons" : ""}{guide ? ", build guide" : ""}{iconVersions.length ? ", icons" : ""} and your access link in one .zip</span>
        </div>
      </div>
    </section>

    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="overview-prompt-heading">
        <div className={styles.cardHeading}><h3 id="overview-prompt-heading">Your prompt</h3><span>{prompt.length.toLocaleString()} characters</span></div>
        <pre className={styles.promptPreview} aria-label="Prompt preview">{prompt.slice(0, 900)}</pre>
        <div className={styles.actions}>
          <button className={shared.primary} type="button" onClick={() => onCopy(prompt, `${title} prompt copied. Paste it into your AI tool to begin.`)}>Copy prompt</button>
          <button className={shared.secondary} type="button" onClick={() => onOpenTab("build")}>View full prompt</button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="overview-icon-heading">
        <div className={styles.cardHeading}><h3 id="overview-icon-heading">App icon</h3><span>{appIcon ? "Purchased" : "Not included"}</span></div>
        {appIcon ? <>
          <div className={styles.iconRow}>
            <div className={styles.iconLarge}>{image ? <Image src={`data:image/png;base64,${image.base64}`} alt="" width={1024} height={1024} unoptimized /> : <span aria-hidden="true">✦</span>}</div>
            <p>{image ? `Version ${image.number} of ${iconVersions.length} · 1024 × 1024 PNG` : icon?.status === "pending" ? "Your icon is being created. This can take a few minutes." : !icon ? "Loading your app icon…" : "Create your icon from your app details, then refine it with up to three updates."}</p>
          </div>
          <div className={styles.actions}><button className={image ? shared.secondary : shared.primary} type="button" onClick={() => onOpenTab("addons")}>{image ? "Manage icon" : "Create app icon"}</button></div>
        </> : <p className={shared.muted}>This order doesn’t include the app icon add-on. Your workspace uses the first letter of your app name.</p>}
      </section>
    </div>

    <section className={styles.card} aria-labelledby="overview-included-heading">
      <div className={styles.cardHeading}><h3 id="overview-included-heading">Everything in this purchase</h3><span>{included.filter((item) => item.ready).length} of {included.filter((item) => !item.optional).length} ready</span></div>
      <ul className={styles.included}>
        {included.map((item) => <li key={item.label}>
          <span className={item.ready ? styles.ready : styles.todo} aria-hidden="true">{item.ready ? "✓" : item.optional ? "↗" : "○"}</span>
          <div><strong>{item.label}</strong><p>{item.detail}</p></div>
          <button className={styles.textButton} type="button" onClick={() => onOpenTab(item.tab)}>{item.action} →</button>
        </li>)}
      </ul>
    </section>
  </div>;
}
