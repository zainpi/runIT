import { AI_MESSAGE_LIMIT, AiError, type AiGeneration, type AiProject, type AiReply, type AiSnapshot } from "./ai-contract";
import { TRIAL_MESSAGE_LIMIT } from "./trial-contract";
import { AI_RESERVATION_TTL_MS } from "./ai-settings";
import type { TemplateId } from "./catalog";

type RequestRecord = { fingerprint: string; status: "pending" | "complete" | "failed" };
export type OrderAiState = {
  limit?: number;
  used: number;
  attempts: number;
  lastAttempt: number;
  overviewUsed: TemplateId[];
  projects: Partial<Record<TemplateId, AiProject>>;
  requests: Record<string, RequestRecord>;
  pending: { request: AiGeneration; expires: number } | null;
};
export function emptyAiState(): OrderAiState { return { used: 0, attempts: 0, lastAttempt: 0, overviewUsed: [], projects: {}, requests: {}, pending: null }; }
export function expirePending(state: OrderAiState, now: number) {
  if (state.pending && state.pending.expires <= now) failGeneration(state, state.pending.request.requestId);
}
export function snapshot(state: OrderAiState): AiSnapshot {
  const limit = state.limit ?? AI_MESSAGE_LIMIT;
  return { used: state.used, remaining: limit - state.used, limit, pending: !!state.pending, projects: state.projects, overviewUsed: state.overviewUsed };
}
export function reserveGeneration(state: OrderAiState, request: AiGeneration, fingerprint: string, now: number): "reserved" | "replay" {
  expirePending(state, now);
  const prior = state.requests[request.requestId];
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new AiError("This request ID was already used for a different message.", 409);
    if (prior.status === "complete") return "replay";
    if (prior.status === "pending") throw new AiError("Your AI response is still being prepared. Refresh the conversation shortly.", 409);
    throw new AiError("This attempt did not finish. Send it again as a new message; no message was deducted.", 409);
  }
  if (state.pending) throw new AiError("Another message for this purchase is being prepared. Refresh the conversation shortly.", 409);
  const project = state.projects[request.templateId];
  if ((project?.revision ?? 0) !== request.revision) throw new AiError("This conversation changed on another device. Refresh it before sending.", 409);
  if (request.kind === "overview" && state.overviewUsed.includes(request.templateId)) throw new AiError("The free overview for this template has already been used. Send a message to revise it.", 409);
  if (request.kind === "message" && state.used >= (state.limit ?? AI_MESSAGE_LIMIT)) throw new AiError(`All ${state.limit ?? AI_MESSAGE_LIMIT} messages have been used. Your saved plan and chat remain available.`, 429);
  // Failed requests do not consume customer messages, but cannot create unbounded provider spend.
  if (state.attempts >= (state.limit === TRIAL_MESSAGE_LIMIT ? 12 : 60)) throw new AiError("AI attempts for this purchase are paused. Contact support with your receipt.", 429);
  if (now - state.lastAttempt < 3000) throw new AiError("Please wait a few seconds before sending another message.", 429);
  state.attempts++;
  state.lastAttempt = now;
  if (request.kind === "message") state.used++;
  state.requests[request.requestId] = { fingerprint, status: "pending" };
  state.pending = { request, expires: now + AI_RESERVATION_TTL_MS };
  return "reserved";
}
export function completeGeneration(state: OrderAiState, requestId: string, reply: AiReply, now: number) {
  expirePending(state, now);
  if (state.pending?.request.requestId !== requestId) throw new AiError("This attempt expired. Refresh the conversation before retrying.", 409);
  const request = state.pending.request, prior = state.projects[request.templateId];
  state.projects[request.templateId] = {
    brief: request.brief, plan: reply.plan, revision: (prior?.revision ?? 0) + 1,
    appliedRevision: prior?.appliedRevision ?? null, appliedPlan: prior?.appliedPlan ?? null, appliedBrief: prior?.appliedBrief ?? null,
    history: [...(prior?.history ?? []), ...(request.kind === "message" ? [{ role: "user" as const, text: request.message }] : []), { role: "assistant", text: reply.message }],
  };
  if (request.kind === "overview") state.overviewUsed.push(request.templateId);
  state.requests[requestId].status = "complete";
  state.pending = null;
}
export function failGeneration(state: OrderAiState, requestId: string) {
  if (state.pending?.request.requestId !== requestId) return;
  if (state.pending.request.kind === "message") state.used--;
  state.requests[requestId].status = "failed";
  state.pending = null;
}
export function applyPlan(state: OrderAiState, templateId: TemplateId, revision: number) {
  const project = state.projects[templateId];
  if (!project || project.revision !== revision || state.pending) throw new AiError("The plan changed. Refresh the conversation and review it before applying.", 409);
  project.appliedPlan = project.plan;
  project.appliedBrief = project.brief;
  project.appliedRevision = project.revision;
}
export function clearContent(state: OrderAiState) {
  if (state.pending) throw new AiError("Wait for the current response before deleting saved chats.", 409);
  state.projects = {};
  // Keep the quota and fingerprints so deleting content cannot reset purchased usage.
}
