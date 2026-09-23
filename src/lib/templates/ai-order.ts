import { DurableObject } from "cloudflare:workers";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { AiError, type AiGeneration, type AiReply, type AiResult } from "./ai-contract";
import { applyPlan, clearContent, completeGeneration, emptyAiState, expirePending, failGeneration, initializeTrial, reserveGeneration, snapshot, type OrderAiState } from "./ai-state";
import type { Personalization } from "./compose";
import type { TemplateId } from "./catalog";

// One private object per verified Stripe order or redeemed trial. Only the server holds this binding.
export class TemplateAiOrder extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS order_ai (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL)");
  }
  #change<T>(operation: (state: OrderAiState) => T): AiResult<T> {
    return this.ctx.storage.transactionSync(() => {
      const row = this.ctx.storage.sql.exec<{ state: string }>("SELECT state FROM order_ai WHERE id = 1").toArray()[0];
      const state: OrderAiState = row ? JSON.parse(row.state) : emptyAiState();
      expirePending(state, Date.now());
      let result: AiResult<T>;
      try { result = { ok: true, value: operation(state) }; }
      catch (error) {
        if (!(error instanceof AiError)) throw error;
        result = { ok: false, error: error.message, status: error.status };
      }
      this.ctx.storage.sql.exec("INSERT INTO order_ai (id, state) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state", JSON.stringify(state));
      return result;
    });
  }
  initializeTrial(brief?: Personalization) { return this.#change((state) => initializeTrial(state, brief)); }
  read() { return this.#change(snapshot); }
  reserve(request: AiGeneration, fingerprint: string) {
    return this.#change((state) => ({ status: reserveGeneration(state, request, fingerprint, Date.now()), context: state.projects[request.templateId] ?? null, snapshot: snapshot(state) }));
  }
  complete(requestId: string, reply: AiReply) { return this.#change((state) => { completeGeneration(state, requestId, reply, Date.now()); return snapshot(state); }); }
  fail(requestId: string) { return this.#change((state) => { failGeneration(state, requestId); return snapshot(state); }); }
  apply(templateId: TemplateId, revision: number) { return this.#change((state) => { applyPlan(state, templateId, revision); return snapshot(state); }); }
  clear() { return this.#change((state) => { clearContent(state); return snapshot(state); }); }
}
