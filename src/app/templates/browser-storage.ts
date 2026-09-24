import { emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { templateCatalog, type BuildMode, type TemplateId } from "@/lib/templates/catalog";
export type ReceiptProjectNames = Partial<Record<TemplateId, string>>;
export type Receipt = { sessionId: string; accessToken: string; templates: TemplateId[]; createdAt: string; subagents?: boolean; skillTree?: boolean; appIcon?: boolean; projectNames?: ReceiptProjectNames };
const RECEIPTS_KEY = "runit-template-orders-v1";
const DRAFT_KEY = "runit-template-brief-v1";
export function loadReceipts(): Receipt[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "[]");
    return Array.isArray(data) ? data.filter((r): r is Receipt => r && typeof r.sessionId === "string" && /^cs_[A-Za-z0-9_]+$/.test(r.sessionId) && typeof r.accessToken === "string" && /^[a-f0-9]{64}$/.test(r.accessToken) && typeof r.createdAt === "string" && Array.isArray(r.templates)) : [];
  } catch { return []; }
}
export function saveReceipt(receipt: Receipt) {
  const saved = loadReceipts();
  const previous = saved.find((r) => r.sessionId === receipt.sessionId && r.accessToken === receipt.accessToken);
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify([{ ...receipt, projectNames: receipt.projectNames ?? previous?.projectNames }, ...saved.filter((r) => r.sessionId !== receipt.sessionId)].slice(0, 100)));
}
export function receiptName(receipt: Receipt): string {
  const names = receipt.templates.map((id) => receipt.projectNames?.[id]).filter((name): name is string => typeof name === "string" && !!name.trim()).map((name) => name.trim());
  return [...new Set(names)].join(" · ") || templateCatalog.filter((template) => receipt.templates.includes(template.id)).map((template) => template.title).join(" · ") || "Unnamed app";
}
export function withReceiptNames(receipt: Receipt, names: ReceiptProjectNames, overwrite = true): Receipt {
  return { ...receipt, projectNames: overwrite ? { ...receipt.projectNames, ...names } : { ...names, ...receipt.projectNames } };
}
export function saveReceiptNames(receipt: Receipt, names: ReceiptProjectNames, overwrite = true) {
  // Name hydration must not reorder purchases or replace a changed credential.
  const saved = loadReceipts().map((r) => r.sessionId === receipt.sessionId && r.accessToken === receipt.accessToken ? withReceiptNames(r, names, overwrite) : r);
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(saved));
}
export function receiptLink(receipt: Receipt) { return `${location.origin}/templates/library/#session_id=${encodeURIComponent(receipt.sessionId)}&access=${receipt.accessToken}`; }
export function loadDraft(): { details: Personalization; mode: BuildMode; selected: TemplateId[]; subagents: boolean; skillTree: boolean; appIcon: boolean } {
  try {
    const data = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    const details = { ...emptyPersonalization };
    for (const key of ["name", "idea", "features", "style", "budget"] as const) if (typeof data.details?.[key] === "string") details[key] = data.details[key].slice(0, 3000);
    details.decideBudget = data.details?.decideBudget === true;
    const selected = templateCatalog.filter((t) => Array.isArray(data.selected) && data.selected.includes(t.id)).map((t) => t.id);
    return { details, mode: data.mode === "computer" ? "computer" : "manual", selected, subagents: data.subagents === true, skillTree: data.skillTree === true, appIcon: data.appIcon === true };
  } catch { return { details: { ...emptyPersonalization }, mode: "manual", selected: [], subagents: false, skillTree: false, appIcon: false }; }
}
export function saveDraft(details: Personalization, mode: BuildMode, selected: TemplateId[], subagents = false, skillTree = false, appIcon = false) { localStorage.setItem(DRAFT_KEY, JSON.stringify({ details, mode, selected, subagents, skillTree, appIcon })); }
export function downloadText(text: string, name: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
