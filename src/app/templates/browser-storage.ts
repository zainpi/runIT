import { emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { templateCatalog, type BuildMode, type TemplateId } from "@/lib/templates/catalog";
export type Receipt = { sessionId: string; accessToken: string; templates: TemplateId[]; createdAt: string; subagents?: boolean; skillTree?: boolean };
const RECEIPTS_KEY = "runit-template-orders-v1";
const DRAFT_KEY = "runit-template-brief-v1";
export function loadReceipts(): Receipt[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "[]");
    return Array.isArray(data) ? data.filter((r): r is Receipt => r && typeof r.sessionId === "string" && /^cs_[A-Za-z0-9_]+$/.test(r.sessionId) && typeof r.accessToken === "string" && /^[a-f0-9]{64}$/.test(r.accessToken) && typeof r.createdAt === "string" && Array.isArray(r.templates)) : [];
  } catch { return []; }
}
export function saveReceipt(receipt: Receipt) {
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify([receipt, ...loadReceipts().filter((r) => r.sessionId !== receipt.sessionId)].slice(0, 100)));
}
export function receiptLink(receipt: Receipt) { return `${location.origin}/templates/library/#session_id=${encodeURIComponent(receipt.sessionId)}&access=${receipt.accessToken}`; }
export function loadDraft(): { details: Personalization; mode: BuildMode; selected: TemplateId[]; subagents: boolean; skillTree: boolean } {
  try {
    const data = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    const details = { ...emptyPersonalization };
    for (const key of Object.keys(details) as (keyof Personalization)[]) if (typeof data.details?.[key] === "string") details[key] = data.details[key].slice(0, 3000);
    const selected = templateCatalog.filter((t) => Array.isArray(data.selected) && data.selected.includes(t.id)).map((t) => t.id);
    return { details, mode: data.mode === "computer" ? "computer" : "manual", selected, subagents: data.subagents === true, skillTree: data.skillTree === true };
  } catch { return { details: { ...emptyPersonalization }, mode: "manual", selected: [], subagents: false, skillTree: false }; }
}
export function saveDraft(details: Personalization, mode: BuildMode, selected: TemplateId[], subagents = false, skillTree = false) { localStorage.setItem(DRAFT_KEY, JSON.stringify({ details, mode, selected, subagents, skillTree })); }
export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
