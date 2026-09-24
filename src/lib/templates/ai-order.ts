import { DurableObject } from "cloudflare:workers";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { AiError, type AiGeneration, type AiReply, type AiResult } from "./ai-contract";
import { applyPlan, claimGuide, clearContent, completeGeneration, completeGuide, emptyAiState, expirePending, failGeneration, initializeTrial, reserveGeneration, snapshot, type OrderAiState } from "./ai-state";
import { generateBuildGuide } from "./guide-provider";
import type { Personalization } from "./compose";
import type { TemplateId } from "./catalog";
import type { IconRequest, IconSnapshot } from "./icon-contract";
import { claimIcon, completeIcon, deleteIcon, emptyIconState, failIcon, iconSnapshot, reserveIcon, type IconState } from "./icon-state";
import { generateAppIcon, iconProviderConfiguration } from "./icon-provider";

// One private object per verified Stripe order or redeemed trial. Only the server holds this binding.
export class TemplateAiOrder extends DurableObject<Record<string, unknown>> {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS order_ai (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS order_icon (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS order_icon_data (version TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (version, part))");
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
  async startGuide(request: AiGeneration, fingerprint: string) {
    try {
      return await this.ctx.storage.transaction(async () => {
        const result = this.#change((state) => {
          if (request.kind !== "guide") throw new AiError("Choose a guide request.");
          reserveGeneration(state, request, fingerprint, Date.now());
          return snapshot(state);
        });
        if (result.ok) await this.#schedule();
        return result;
      });
    } catch (error) {
      if (error instanceof AiError) return { ok: false as const, error: error.message, status: error.status };
      throw error;
    }
  }
  // Icons and guides share one alarm. Always schedule the earliest wakeup while
  // holding the storage transaction, so jobs cannot erase each other's wakeup.
  async #schedule() {
    const icon = this.#readIconState().pending;
    const row = this.ctx.storage.sql.exec<{ state: string }>("SELECT state FROM order_ai WHERE id = 1").toArray()[0];
    const ai: OrderAiState | null = row ? JSON.parse(row.state) : null;
    const guide = ai?.pending?.request.kind === "guide" ? ai.pending : null;
    const times = [icon, guide].filter((p) => !!p).map((p) => p!.started ? p!.expires : Date.now() + 1);
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
  }

  #readIconState(): IconState {
    const row = this.ctx.storage.sql.exec<{ state: string }>("SELECT state FROM order_icon WHERE id = 1").toArray()[0];
    return row ? JSON.parse(row.state) : emptyIconState();
  }
  #saveIconState(state: IconState) {
    this.ctx.storage.sql.exec("INSERT INTO order_icon (id, state) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state", JSON.stringify(state));
  }
  #iconData(version: string): string {
    return this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM order_icon_data WHERE version = ? ORDER BY part", version).toArray().map((row) => row.data).join("");
  }
  #iconSnapshot(state: IconState, versionId?: string): IconSnapshot {
    const version = versionId ?? state.versions.at(-1)?.id;
    return iconSnapshot(state, version ? this.#iconData(version) : undefined, versionId);
  }
  readIcon(versionId?: string): AiResult<IconSnapshot> {
    try { return { ok: true, value: this.#iconSnapshot(this.#readIconState(), versionId) }; }
    catch (error) {
      if (error instanceof AiError) return { ok: false, error: error.message, status: error.status };
      throw error;
    }
  }
  async startIcon(request: IconRequest, fingerprint: string): Promise<AiResult<IconSnapshot>> {
    try {
      // The reservation and wakeup commit together; a lost HTTP response is safe to retry.
      return await this.ctx.storage.transaction(async () => {
        const state = this.#readIconState();
        const created = reserveIcon(state, request, fingerprint);
        this.#saveIconState(state);
        if (created) await this.#schedule();
        return { ok: true, value: this.#iconSnapshot(state, request.baseVersion) };
      });
    } catch (error) {
      if (error instanceof AiError) return { ok: false, error: error.message, status: error.status };
      throw error;
    }
  }
  deleteIcon(): AiResult<IconSnapshot> {
    try {
      return this.ctx.storage.transactionSync(() => {
        const state = this.#readIconState();
        deleteIcon(state);
        this.ctx.storage.sql.exec("DELETE FROM order_icon_data");
        this.#saveIconState(state);
        return { ok: true, value: this.#iconSnapshot(state) };
      });
    } catch (error) {
      if (error instanceof AiError) return { ok: false, error: error.message, status: error.status };
      throw error;
    }
  }
  async #runIcon() {
    const claim = this.ctx.storage.transactionSync(() => {
      const state = this.#readIconState();
      const request = claimIcon(state, Date.now());
      this.#saveIconState(state);
      return { request, expires: state.pending?.expires };
    });
    // A repeated alarm never repeats an in-flight provider call. The later wakeup
    // releases an interrupted attempt for an explicit, bounded customer retry.
    await this.ctx.storage.transaction(() => this.#schedule());
    if (!claim.request) return;
    const request = claim.request;
    try {
      const base64 = await generateAppIcon(iconProviderConfiguration(this.env), request, request.baseVersion ? this.#iconData(request.baseVersion) : undefined);
      this.ctx.storage.transactionSync(() => {
        const state = this.#readIconState();
        if (!completeIcon(state, request.requestId, Date.now())) return;
        // Keep each row well below SQLite's 2 MB row limit, even for detailed PNGs.
        const chunkSize = 256 * 1024;
        for (let offset = 0; offset < base64.length; offset += chunkSize) {
          this.ctx.storage.sql.exec("INSERT INTO order_icon_data (version, part, data) VALUES (?, ?, ?)", request.requestId, offset / chunkSize, base64.slice(offset, offset + chunkSize));
        }
        this.#saveIconState(state);
      });
    } catch {
      this.ctx.storage.transactionSync(() => {
        const state = this.#readIconState();
        failIcon(state, request.requestId, "The icon could not finish. You can retry; this attempt did not use your icon allowance.");
        this.#saveIconState(state);
      });
    }
  }
  async #runGuide() {
    const claim = this.#change((state) => claimGuide(state, Date.now()));
    await this.ctx.storage.transaction(() => this.#schedule());
    if (!claim.ok || !claim.value) return;
    const { request, project } = claim.value;
    try {
      const document = await generateBuildGuide(this.env, request, project);
      this.#change((state) => completeGuide(state, request.requestId, document, Date.now()));
    } catch {
      this.fail(request.requestId);
    }
  }
  async alarm() {
    await Promise.all([this.#runIcon(), this.#runGuide()]);
    await this.ctx.storage.transaction(() => this.#schedule());
  }
}
