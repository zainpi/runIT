import type { TemplateId } from "./catalog";

export const ICON_MAX_BYTES = 6 * 1024 * 1024;
export const ICON_MAX_BASE64 = Math.ceil(ICON_MAX_BYTES / 3) * 4;
export const ICON_PROVIDER_TIMEOUT_MS = 180_000;
export const ICON_LEASE_MS = 240_000;
export const ICON_ATTEMPT_LIMIT = 3;
export const ICON_UPDATE_LIMIT = 3;
export type IconRequest = {
  requestId: string;
  templateId: TemplateId;
  brief: { name: string; idea: string; style: string };
  direction: string;
  baseVersion?: string;
};
export type IconVersion = { id: string; number: number; fileName: string; createdAt: string; templateId: TemplateId; brief: IconRequest["brief"]; baseVersion?: string };
export type IconImage = IconVersion & { base64: string };
export type IconSnapshot = {
  status: "ready" | "pending" | "complete" | "failed" | "deleted";
  canGenerate: boolean;
  updatesRemaining: number;
  versions: IconVersion[];
  error?: string;
  image?: IconImage;
};
