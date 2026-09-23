"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import type { IconSnapshot } from "@/lib/templates/icon-contract";
import type { Receipt } from "../browser-storage";
import shared from "../templates.module.css";
import styles from "./app-icon-generator.module.css";

export function AppIconGenerator({ receipt, templateId, details }: { receipt: Pick<Receipt, "sessionId" | "accessToken">; templateId: TemplateId; details: Personalization }) {
  const [state, setState] = useState<IconSnapshot | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingRequest = useRef<AbortController | null>(null);
  const knownVersions = useRef(0);
  const { sessionId, accessToken } = receipt;
  const act = useCallback(async (action: "load" | "generate" | "download" | "delete", extra: Record<string, unknown> = {}) => {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/templates/icon/", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action, sessionId, accessToken, ...extra }),
      });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Your icon could not be loaded."); }
      if (action === "download") {
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob), anchor = document.createElement("a");
        anchor.href = url; anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "app-icon.png";
        anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const result = await response.json();
        if (controller.signal.aborted) return;
        setState(result.state); setAvailable(result.available === true); setConfirmDelete(false);
        if (action === "generate" || result.state.versions.length > knownVersions.current) setDirection("");
        knownVersions.current = result.state.versions.length;
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your icon could not be loaded. Refresh its status before trying again.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }, [sessionId, accessToken]);
  useEffect(() => { void act("load"); return () => pendingRequest.current?.abort(); }, [act]);
  useEffect(() => {
    if (state?.status !== "pending" || busy || error) return;
    const timer = setTimeout(() => void act("load"), 5000);
    return () => clearTimeout(timer);
  }, [state, busy, error, act]);
  const selected = state?.image;
  const updating = !!selected;
  const canSubmit = !busy && !error && available && consent && (updating ? !!direction.trim() : !!details.idea.trim());

  return <section className={styles.generator} aria-labelledby="app-icon-heading">
    <div className={styles.heading}><div><p className={shared.eyebrow}>Purchased add-on</p><h2 id="app-icon-heading">Create app icon</h2></div><span>1 icon + 3 updates</span></div>
    <p className={shared.muted}>Create your icon, then refine it with up to three updates. Browse and download any version as a 1024 × 1024 PNG. Every version is saved to this private purchase link.</p>
    {!state && !error && <p role="status">Loading your app icon…</p>}
    {error && <div className={styles.error}><p role="alert">{error}</p><button className={shared.secondary} disabled={busy} onClick={() => void act("load")}>Refresh icon status</button></div>}
    {state?.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state?.status === "pending" && <p className={styles.pending} role="status">Creating your icon… This can take a few minutes. You can leave this page and return to your saved purchase link.</p>}
    {selected && <>
      <div className={styles.versions} role="group" aria-label="Icon versions">{state.versions.map((version) => <button key={version.id} type="button" aria-pressed={version.id === selected.id} disabled={busy} onClick={() => void act("load", { versionId: version.id })}>Version {version.number}{version.number === 1 ? " · Original" : ""}</button>)}</div>
      <div className={styles.result}>
        <Image className={styles.preview} src={`data:image/png;base64,${selected.base64}`} alt={`Your app icon, version ${selected.number}`} width={1024} height={1024} unoptimized />
        <div><p>Version {selected.number}{selected.baseVersion ? ` · Updated from version ${state.versions.find((version) => version.id === selected.baseVersion)?.number}` : " · Original"}</p><p className={shared.small}>1024 × 1024 · PNG</p><button className={shared.primary} disabled={busy} onClick={() => void act("download", { versionId: selected.id })}>Download version {selected.number} ↓</button>
          <p className={styles.allowance}>{state.updatesRemaining === 0 ? "All 3 updates used. Every version is still yours to download." : `${state.updatesRemaining} ${state.updatesRemaining === 1 ? "update" : "updates"} remaining`}</p>
        </div>
      </div>
    </>}
    {state?.canGenerate && <form onSubmit={(event) => {
      event.preventDefault();
      if (canSubmit) void act("generate", { templateId: selected?.templateId ?? templateId, brief: selected ? { ...emptyPersonalization, ...selected.brief } : details, direction, consent, requestId: crypto.randomUUID(), ...(selected ? { baseVersion: selected.id } : {}) });
    }}>
      <p className={shared.small}>{selected ? `Update version ${selected.number}. Your earlier versions will stay available. Each completed update uses 1 of your 3 included updates.` : `For ${details.name.trim() || templateCatalog.find((item) => item.id === templateId)?.title}. Finish your app description and style above before generating.`}</p>
      <label htmlFor="icon-direction">{updating ? "What should change?" : <>Icon direction <span>optional</span></>}</label>
      <textarea id="icon-direction" value={direction} maxLength={800} rows={3} required={updating} disabled={busy} placeholder={updating ? "Keep the mountain, make the background darker, and simplify the details…" : "Colors, a symbol, or a mood you have in mind…"} onChange={(event) => setDirection(event.target.value)} />
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /><span>Use OpenAI to create or update my icon using my brief and selected image. Save the versions to my private purchase link.</span></label>
      {!available && <p className={shared.small}>Icon generation is temporarily unavailable. Try again later.</p>}
      {!updating && !details.idea.trim() && <p className={shared.small}>Add your app description above to begin.</p>}
      <button className={shared.primary} type="submit" disabled={!canSubmit}>{busy ? "Starting…" : updating ? "Update selected icon" : state.status === "failed" ? "Retry icon generation" : "Generate app icon"}</button>
    </form>}
    {selected && (confirmDelete ? <div className={styles.delete}><p>Delete all saved icon versions? Download any you want to keep first. This permanently removes the images and ends further updates; it won’t reset your allowance.</p><button className={shared.secondary} disabled={busy || state.status === "pending"} onClick={() => void act("delete")}>Confirm delete icons</button><button className={shared.secondary} disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button className={styles.deleteLink} disabled={busy || state.status === "pending"} onClick={() => setConfirmDelete(true)}>Delete saved icons</button>)}
    {state?.status === "deleted" && <p>Your saved icons were deleted. Your icon allowance has not been reset.</p>}
  </section>;
}
