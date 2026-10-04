"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./plan-loading.module.css";

type LoadingDetails = { title: string; description: string };
const LoadingContext = createContext<((id: string, details: LoadingDetails | null) => void) | null>(null);

// One screen spans payment/access loading, saved-state loading and generation.
// Keeping it in the layout prevents a flash of the dashboard between those steps.
export function PlanLoadingProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Map<string, LoadingDetails>>(() => new Map());
  const update = useCallback((id: string, details: LoadingDetails | null) => {
    setRequests((current) => {
      if (!details && !current.has(id)) return current;
      const next = new Map(current);
      if (details) next.set(id, details); else next.delete(id);
      return next;
    });
  }, []);
  const details = Array.from(requests.values()).at(-1) ?? null;
  return <LoadingContext.Provider value={update}>{children}<PlanLoading details={details} /></LoadingContext.Provider>;
}

export function usePlanLoading(active: boolean, { title, description }: LoadingDetails) {
  const update = useContext(LoadingContext);
  const id = useId();
  useEffect(() => {
    update?.(id, active ? { title, description } : null);
  }, [update, id, active, title, description]);
  useEffect(() => () => update?.(id, null), [update, id]);
}

function PlanLoading({ details }: { details: LoadingDetails | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lastDetails = useRef<LoadingDetails | null>(null);
  const titleId = useId(), descriptionId = useId();
  const active = !!details;
  if (details) lastDetails.current = details;
  const copy = details ?? lastDetails.current;

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (active) {
      if (!node.open) node.showModal();
      return;
    }
    // Leave the updated workspace mounted under the screen during the reveal.
    const timer = window.setTimeout(() => node.close(), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = overflow; };
  }, [active]);

  return <dialog ref={dialog} className={styles.screen} data-active={active} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => event.preventDefault()}>
    <div className={styles.loading}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Your workspace</p>
        <h2 id={titleId} className={styles.title}>{copy?.title}</h2>
      </div>
      <div className={styles.track} role="progressbar" aria-label={copy?.title} aria-valuetext="In progress">
        <span className={styles.fill} />
      </div>
      <p id={descriptionId} className={styles.description} role="status">{copy?.description}</p>
    </div>
  </dialog>;
}
