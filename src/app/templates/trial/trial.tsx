"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { validTrialId, type TrialAccess } from "@/lib/templates/trial-contract";
import { TrialDashboard } from "./dashboard";
import styles from "../templates.module.css";

export function TemplateTrial() {
  const [access, setAccess] = useState<TrialAccess | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let generation = 0;
    async function open() {
      const current = ++generation;
      setAccess(null); setTemplateId(null); setError(""); setLoading(true);
      const hash = new URLSearchParams(location.hash.slice(1));
      const sessionId = hash.get("session_id"), accessToken = hash.get("access");
      if (!validTrialId(sessionId) || !accessToken || !/^[a-f0-9]{64}$/.test(accessToken)) { setError("Open your full private trial link, or redeem a code on the templates page."); setLoading(false); return; }
      try {
        const response = await fetch("/api/templates/trial/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", sessionId, accessToken }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (generation !== current) return;
        if (!templateCatalog.some((t) => t.id === result.templateId)) throw new Error("This trial template is unavailable.");
        setTemplateId(result.templateId); setAccess({ sessionId, accessToken }); setUrl(location.href);
        try { localStorage.setItem("runit-template-trial", JSON.stringify({ sessionId, accessToken })); } catch { /* Save-link controls are still available. */ }
      } catch (cause) { if (generation === current) setError(cause instanceof Error ? cause.message : "Your trial could not be loaded."); }
      finally { if (generation === current) setLoading(false); }
    }
    void open(); window.addEventListener("hashchange", open);
    return () => { generation++; window.removeEventListener("hashchange", open); };
  }, []);
  return <>
    {loading && <section className={styles.libraryHero}><p className={styles.eyebrow}>Project dashboard</p><h1>Your workspace.</h1><p role="status">Opening your trial…</p></section>}
    {error && <section className={styles.libraryHero}><h1>Let’s get you back in.</h1><p role="alert" className={styles.notice}>{error} <Link href="/templates/#free-trial">Enter a trial code →</Link></p><button className={styles.secondary} onClick={() => window.dispatchEvent(new Event("hashchange"))}>Retry opening trial</button></section>}
    {access && templateId && <TrialDashboard key={`${access.sessionId}:${access.accessToken}`} access={access} templateId={templateId} url={url} />}
  </>;
}
