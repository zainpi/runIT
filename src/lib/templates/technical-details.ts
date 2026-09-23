import { templateCatalog, type TemplateId } from "./catalog";
import type { AppPlan } from "./ai-contract";

const startingPoints: Record<TemplateId, string[]> = {
  "discord-bot": [
    "Keep Discord event handlers separate from scheduled jobs and external API adapters.",
    "Persist per-server settings and job state; make retries safe before enabling automation.",
    "Scope bot permissions by server, keep tokens out of logs, and monitor failed commands and restarts.",
  ],
  "roblox-game": [
    "Keep gameplay state authoritative on the Roblox server; treat client input as untrusted.",
    "Persist progression with DataStore using bounded writes and recovery for interrupted saves.",
    "Validate RemoteEvent payloads and verify purchases on the server before granting rewards.",
  ],
  "mobile-game": [
    "Separate Godot game state from scenes and UI so progress can be saved and restored.",
    "Add a backend only for enabled accounts, cloud saves, or online features; define sync conflicts first.",
    "Test touch controls, performance, and store builds on the target iOS and Android devices.",
  ],
  "mobile-app": [
    "Keep SwiftUI screens separate from account, data, and networking layers.",
    "Define data ownership and offline behavior before adding cloud sync or user accounts.",
    "Test sign-in, permissions, and release builds on real devices before store submission.",
  ],
  storefront: [
    "Keep product, cart, and order records separate; calculate totals and verify payments on the server.",
    "Use Stripe webhooks with idempotent order fulfillment and an auditable payment state.",
    "Plan domain, deployment, backups, and order notification failures before launch.",
  ],
  "browser-game": [
    "Separate browser rendering and input from trusted score or account logic.",
    "Persist only the state this game needs; validate scores and rate-limit public endpoints on the server.",
    "Test mobile controls and measure third-party API usage before production deployment.",
  ],
};

export function planTechnicalDetails(plan: AppPlan, templateId: TemplateId): { notes: string[]; generated: boolean } {
  const notes = Array.isArray(plan.technicalDetails) ? plan.technicalDetails.filter((note) => typeof note === "string" && note.trim()) : [];
  if (notes?.length) return { notes, generated: true };
  const stack = templateCatalog.find((item) => item.id === templateId)?.stack;
  return { notes: stack ? [`Template starting stack: ${stack}. Confirm each service against the final feature scope.`, ...startingPoints[templateId]] : startingPoints[templateId], generated: false };
}
