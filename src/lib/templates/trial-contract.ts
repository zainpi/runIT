export const TRIAL_MESSAGE_LIMIT = 3;
export type TrialAccess = { sessionId: string; accessToken: string };
export function validTrialId(value: unknown): value is string { return typeof value === "string" && /^trial_[a-f0-9]{64}$/.test(value); }
