"use client";
import { useState } from "react";
import type { AppPlan } from "@/lib/templates/ai-contract";
import type { TemplateId } from "@/lib/templates/catalog";
import { planTechnicalDetails } from "@/lib/templates/technical-details";
import styles from "./trial/dashboard.module.css";
import layout from "./plan-overview.module.css";

export function PlanOverview({ plan, templateId, name, revision, canRefine, onRefine, singleColumn = false }: {
  plan: AppPlan; templateId: TemplateId; name: string; revision: number;
  singleColumn?: boolean;
  canRefine(message: string): boolean;
  onRefine(message: string): void;
}) {
  const [flippedFeature, setFlippedFeature] = useState<string | null>(null);
  const [hoverSuppressedFeature, setHoverSuppressedFeature] = useState<string | null>(null);
  const technical = planTechnicalDetails(plan, templateId);
  return <>
    <p className={styles.overview}>{plan.overview}</p>
    <div className={styles.featureHeading}><h3>What it will do</h3><span>{plan.features.length} features{!singleColumn && " · Hover or tap a card"}</span></div>
    <div className={singleColumn ? layout.featureList : styles.featureGrid} role="list" aria-label={`Features for ${name || "your app"}`}>{plan.features.map((feature, index) => {
      const cardId = `${revision}:${index}`, flipped = flippedFeature === cardId;
      const refinement = `Let’s change ${feature.part.toLowerCase()}: `;
      if (singleColumn) return <article className={layout.featureRow} role="listitem" key={cardId}>
        <div><span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span><h4>{feature.part}</h4><p>{feature.description}</p></div>
        <button className={styles.refine} type="button" disabled={!canRefine(refinement)} onClick={() => onRefine(refinement)}>Refine in chat <span aria-hidden="true">↗</span></button>
      </article>;
      return <article className={styles.featureTile} role="listitem" key={cardId}>
        <button className={styles.featureCard} type="button" data-flipped={flipped} data-hover-suppressed={hoverSuppressedFeature === cardId} aria-pressed={flipped} aria-label={`${feature.part}. ${feature.description} ${flipped ? "Show feature name" : "Show description"}`} onClick={() => { setFlippedFeature(flipped ? null : cardId); setHoverSuppressedFeature(flipped ? cardId : null); }} onMouseLeave={() => setHoverSuppressedFeature(null)}>
          <span className={styles.featureCardInner} aria-hidden="true">
            <span className={`${styles.featureFace} ${styles.featureFront}`}><span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span><strong>{feature.part}</strong><span className={styles.featureHint}>View details ↗</span></span>
            <span className={`${styles.featureFace} ${styles.featureBack}`}><span className={styles.featureBackLabel}>How it works</span><span className={styles.featureDescription}>{feature.description}</span><span className={styles.featureHint}>Tap to flip back ↶</span></span>
          </span>
        </button>
        <button className={styles.refine} type="button" disabled={!canRefine(refinement)} onClick={() => onRefine(refinement)}>Refine in chat <span aria-hidden="true">↗</span></button>
      </article>;
    })}</div>
    <details className={styles.technicalDetails}><summary>Technical details <span>{technical.notes.length} notes</span></summary><p>{technical.generated ? "Proposed implementation notes for this plan. Validate choices before building." : "Starting points based on this template. Review them against your final feature scope."}</p><ul>{technical.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>
  </>;
}
