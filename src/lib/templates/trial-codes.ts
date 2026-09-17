import { DurableObject } from "cloudflare:workers";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { templateCatalog, type TemplateId } from "./catalog";
import type { AiResult } from "./ai-contract";

// Server-only campaign definition. The redeemable code is never sent to browsers.
const CODE_HASH = "f8875bc63316f453c359921fec361600e0e6f220269a743c75a486dec60455e5";
const TRIAL_REDEMPTION_LIMIT = 50;
type Access = { templateId: TemplateId };

// Every redemption uses this single registry, including requests from different domains.
export class TemplateTrialCodes extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS trial_access (access_hash TEXT PRIMARY KEY, template_id TEXT NOT NULL, created_at INTEGER NOT NULL)");
  }
  redeem(codeHash: string, accessHash: string, templateId: TemplateId): AiResult<Access> {
    if (codeHash !== CODE_HASH) return { ok: false, error: "That trial code is not valid. Check it and try again.", status: 400 };
    if (!/^[a-f0-9]{64}$/.test(accessHash) || !templateCatalog.some((t) => t.id === templateId)) return { ok: false, error: "Choose a template and try again.", status: 400 };
    return this.ctx.storage.transactionSync(() => {
      const existing = this.authorize(accessHash);
      if (existing.ok) return existing.value.templateId === templateId ? existing : { ok: false, error: "This trial link already belongs to another template. Open your saved trial.", status: 409 };
      const count = this.ctx.storage.sql.exec<{ total: number }>("SELECT COUNT(*) AS total FROM trial_access").one().total;
      if (count >= TRIAL_REDEMPTION_LIMIT) return { ok: false, error: "This trial code has reached its 50-use limit.", status: 410 };
      this.ctx.storage.sql.exec("INSERT INTO trial_access (access_hash, template_id, created_at) VALUES (?, ?, ?)", accessHash, templateId, Date.now());
      return { ok: true, value: { templateId } };
    });
  }
  authorize(accessHash: string): AiResult<Access> {
    const row = this.ctx.storage.sql.exec<{ template_id: TemplateId }>("SELECT template_id FROM trial_access WHERE access_hash = ?", accessHash).toArray()[0];
    return row ? { ok: true, value: { templateId: row.template_id } } : { ok: false, error: "Open your full private trial link, or redeem a trial code.", status: 403 };
  }
}
