"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sameBrief, type AiGeneration, type AiSnapshot } from "@/lib/templates/ai-contract";
import type { TemplateId } from "@/lib/templates/catalog";
import type { Personalization } from "@/lib/templates/compose";
import type { TrialAccess } from "@/lib/templates/trial-contract";

export function useTrialProject(access: TrialAccess, templateId: TemplateId) {
  const [state, setState] = useState<AiSnapshot | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const sending = useRef(false);
  const mounted = useRef(false);
  const autoStarted = useRef(false);
  const attempt = useRef<{ fingerprint: string; generation: AiGeneration } | null>(null);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/templates/ai/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...access, ...payload }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Your plan could not be loaded. Try again.");
    return result as { state: AiSnapshot; available: boolean };
  }, [access]);

  const accept = useCallback((result: { state: AiSnapshot; available: boolean }) => {
    if (!mounted.current) return;
    setState(result.state); setAvailable(result.available);
    const pending = attempt.current?.generation, project = result.state?.projects[templateId];
    // Recover a committed reply even if its HTTP response was lost.
    if (pending && project && project.revision > pending.revision && sameBrief(project.brief, pending.brief)
      && (pending.kind === "overview" || project.history.filter((item) => item.role === "user").at(-1)?.text === pending.message)) {
      if (pending.kind === "message") setMessage((current) => current.trim() === pending.message ? "" : current);
      attempt.current = null; setError(""); setStatus("Plan updated and saved.");
    }
  }, [templateId]);

  const refresh = useCallback(async (clearError = true) => {
    try {
      const result = await request({ action: "load" }); accept(result);
      if (clearError && mounted.current && !result.state?.pending && !attempt.current) setError("");
      return result;
    }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not load your saved plan. Try again."); return null; }
    finally { if (mounted.current) setLoading(false); }
  }, [request, accept]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  useEffect(() => {
    if (!state?.pending || busy) return;
    const timer = setTimeout(() => { void refresh(); }, 3000);
    return () => clearTimeout(timer);
  }, [state, busy, refresh]);

  const generate = useCallback(async (kind: "overview" | "message", brief: Personalization, text = "", automatic = false) => {
    if (sending.current || !state || state.pending) return;
    sending.current = true; setBusy(true); setError(""); setStatus("");
    const revision = state.projects[templateId]?.revision ?? 0;
    const payload = { kind, templateId, brief, message: text.trim(), revision };
    const fingerprint = JSON.stringify(payload);
    // All tabs opening the same fresh checkout use the same first-overview request.
    const hex = access.sessionId.slice(6, 38);
    const automaticId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const generation = attempt.current?.fingerprint === fingerprint ? attempt.current.generation : { ...payload, requestId: automatic ? automaticId : crypto.randomUUID() };
    attempt.current = { fingerprint, generation };
    try {
      const result = await request({ ...generation, action: kind, consent: true });
      accept(result);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : "The response didn’t arrive. Your message is still here.");
      const result = await refresh(false);
      if (result && !result.state.pending) attempt.current = null;
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [state, templateId, access.sessionId, request, accept, refresh]);

  useEffect(() => {
    if (!autoStarted.current && available && state?.canStartOverview && state.initialBrief && !state.pending) {
      autoStarted.current = true;
      void generate("overview", state.initialBrief, "", true);
    }
  }, [available, state, generate]);

  async function clear() {
    if (sending.current || state?.pending) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const result = await request({ action: "clear" });
      attempt.current = null; accept(result); setMessage(""); setStatus("Saved brief, plan, and chat deleted. Your message allowance is unchanged.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete your saved content. Try again."); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  return { state, available, loading, busy, error, status, message, setMessage, generate, refresh, clear };
}
