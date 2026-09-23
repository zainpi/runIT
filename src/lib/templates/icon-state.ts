import { AiError } from "./ai-contract";
import { ICON_ATTEMPT_LIMIT, ICON_LEASE_MS, ICON_UPDATE_LIMIT, type IconVersion, type IconRequest, type IconSnapshot } from "./icon-contract";

export type IconState = {
  generated: number;
  attempts: number;
  requests: Record<string, string>;
  pending: { request: IconRequest; started: boolean; expires: number } | null;
  versions: IconVersion[];
  error?: string;
};
export const emptyIconState = (): IconState => ({ generated: 0, attempts: 0, requests: {}, pending: null, versions: [] });
export function iconSnapshot(state: IconState, base64?: string, versionId?: string): IconSnapshot {
  const version = versionId ? state.versions.find((item) => item.id === versionId) : state.versions.at(-1);
  if (versionId && !version) throw new AiError("This icon version is not available in your order.", 404);
  return {
    status: state.pending ? "pending" : state.error ? "failed" : state.versions.length ? "complete" : state.generated ? "deleted" : "ready",
    canGenerate: state.generated <= ICON_UPDATE_LIMIT && (!state.generated || !!state.versions.length) && !state.pending && state.attempts < ICON_ATTEMPT_LIMIT,
    updatesRemaining: Math.max(0, ICON_UPDATE_LIMIT - Math.max(0, state.generated - 1)),
    versions: state.versions,
    ...(state.error ? { error: state.error } : {}),
    ...(version && base64 ? { image: { ...version, base64 } } : {}),
  };
}
export function reserveIcon(state: IconState, request: IconRequest, fingerprint: string): boolean {
  const previous = state.requests[request.requestId];
  if (previous) {
    if (previous !== fingerprint) throw new AiError("This icon request was already used with a different brief.", 409);
    return false;
  }
  if (state.generated > ICON_UPDATE_LIMIT) throw new AiError("All three icon updates have been used. You can still browse and download every saved version.", 409);
  if (state.generated && !state.versions.length) throw new AiError("Your saved icons have been deleted. Deleting images does not reset your allowance.", 409);
  if (state.pending) throw new AiError("Your icon is still being generated. Refresh its status shortly.", 409);
  if (state.attempts >= ICON_ATTEMPT_LIMIT) throw new AiError("Icon generation needs help. Contact support with your receipt.", 429);
  if (state.generated && (!request.baseVersion || !state.versions.some((item) => item.id === request.baseVersion))) throw new AiError("Choose a saved icon version to update.", 409);
  if (!state.generated && request.baseVersion) throw new AiError("Generate your first icon before updating it.", 409);
  if (state.generated && !request.direction.trim()) throw new AiError("Describe what you want to change in your icon.");
  state.requests[request.requestId] = fingerprint;
  state.attempts++;
  state.pending = { request, started: false, expires: 0 };
  delete state.error;
  return true;
}
export function claimIcon(state: IconState, now: number): IconRequest | null {
  if (!state.pending) return null;
  if (state.pending.started) {
    if (state.pending.expires <= now) failIcon(state, state.pending.request.requestId, "The icon could not finish. You can retry; this attempt did not use your icon allowance.");
    return null;
  }
  state.pending.started = true;
  state.pending.expires = now + ICON_LEASE_MS;
  return state.pending.request;
}
export function completeIcon(state: IconState, requestId: string, now: number): boolean {
  if (state.pending?.request.requestId !== requestId) return false;
  const { brief, templateId, baseVersion } = state.pending.request;
  const name = brief.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || templateId;
  state.generated++;
  state.versions.push({ id: requestId, number: state.generated, fileName: `${name}-icon-v${state.generated}.png`, templateId, brief, createdAt: new Date(now).toISOString(), ...(baseVersion ? { baseVersion } : {}) });
  state.attempts = 0;
  state.pending = null;
  delete state.error;
  return true;
}
export function failIcon(state: IconState, requestId: string, message: string) {
  if (state.pending?.request.requestId !== requestId) return;
  state.pending = null;
  state.error = state.attempts < ICON_ATTEMPT_LIMIT ? message : "Icon generation needs help. Contact support with your receipt.";
}
export function deleteIcon(state: IconState) {
  if (state.pending) throw new AiError("Wait for your icon to finish before deleting it.", 409);
  state.versions = [];
  delete state.error;
  // Keep usage and request fingerprints: deletion never restores the allowance.
}
