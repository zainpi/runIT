"use client";
import { useMemo, useState } from "react";
import type { AiProject } from "@/lib/templates/ai-contract";
import { sameBrief } from "@/lib/templates/ai-contract";
import { composePrompt, type Personalization } from "@/lib/templates/compose";
import type { BuildMode } from "@/lib/templates/catalog";
import { buildGuideHtml } from "@/lib/templates/guide-html";
import { downloadText } from "../browser-storage";
import styles from "../templates.module.css";
import guideStyles from "./build-guide.module.css";

export function buildGuideFileName(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "my-app";
  return `${slug}-complete-guide.html`;
}

export function BuildGuide({ project, details, title, foundation, mode, subagents, skillTree }: { project: AiProject; details: Personalization; title: string; foundation: string; mode: BuildMode; subagents?: string; skillTree?: string }) {
  const [preview, setPreview] = useState(false);
  const artifact = project.guide;
  const html = useMemo(() => artifact ? buildGuideHtml(artifact, composePrompt(title, foundation, artifact.brief, mode, subagents, skillTree, artifact.plan, artifact)) : "", [artifact, title, foundation, mode, subagents, skillTree]);
  if (!artifact) return null;
  const stale = artifact.sourceRevision !== project.revision || !sameBrief(artifact.brief, details);
  return <section className={guideStyles.guide} aria-labelledby="build-guide-heading">
    <p className={styles.eyebrow}>Your complete app blueprint</p><h2 id="build-guide-heading">Read it. Try it. Build it.</h2>
    <p>One HTML file with simple setup steps, official resources, a detailed specification, acceptance checks, and a clickable prototype. Your full coding AI prompt is inside.</p>
    <p className={styles.small}>Saved from plan revision {artifact.sourceRevision} · {artifact.generatedAt.slice(0, 10)} · Export uses your current {mode === "computer" ? "computer control" : "manual"} mode and purchased add-ons.</p>
    {stale && <p className={styles.notice}>This guide belongs to an earlier plan or brief. You can still download that version. Update your plan and regenerate the guide to include your changes. Its earlier specification is excluded from your current prompt below.</p>}
    <div className={styles.actions}><button className={styles.primary} onClick={() => downloadText(html, buildGuideFileName(artifact.brief.name), "text/html;charset=utf-8")}>Download complete HTML guide</button><button className={styles.secondary} aria-expanded={preview} aria-controls="guide-preview" onClick={() => setPreview(!preview)}>{preview ? "Close guide preview" : "Preview guide & prototype"}</button></div>
    <p className={styles.small}>Open the downloaded file in any modern browser. The prototype uses sample data; it does not create accounts, save app data or connect services. Your coding AI still needs to implement and verify the app.</p>
    {preview && <iframe id="guide-preview" title="Complete build guide and simulated app prototype" className={guideStyles.preview} srcDoc={html} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals" referrerPolicy="no-referrer" />}
  </section>;
}
