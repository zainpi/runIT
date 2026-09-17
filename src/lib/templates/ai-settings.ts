export const AI_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;
export type AiReasoningEffort = typeof AI_REASONING_EFFORTS[number];
// Leave time for authorization and saving after the provider deadline.
export const AI_PROVIDER_TIMEOUT_MS = 120_000;
export const AI_RESERVATION_TTL_MS = 180_000;
export function isReasoningEffort(value: unknown): value is AiReasoningEffort {
  return typeof value === "string" && AI_REASONING_EFFORTS.some((effort) => effort === value);
}
