// Official UI compatibility and current-device context; authorization stays in SQL.
export const GAME_EPOCH = 2;
export const ADMIN_SESSION_KEY = "the-last-echo.admin.session.v2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type AdminSession = { account: string; nonce: string; epoch: number };
export type SessionStore = { read(): AdminSession | null; write(value: AdminSession): void; clear(): void; generation(): number };
export type AdminLoginAttempt = { generation: number };
export class AdminLoginSuperseded extends Error {
 constructor(){super("Your sign-in or session changed. Start a new sign-in.");}
}
export function beginAdminLogin(store: SessionStore): AdminLoginAttempt {
 store.clear();return {generation:store.generation()};
}
export function isAdminLoginCurrent(store: SessionStore,attempt: AdminLoginAttempt): boolean {
 return store.generation()===attempt.generation;
}
function assertLoginCurrent(store: SessionStore,attempt: AdminLoginAttempt): void {
 if(!isAdminLoginCurrent(store,attempt))throw new AdminLoginSuperseded();
}
type RpcResult = { data: unknown; error: { message?: string } | null };
export interface AdminAdapter {
 auth: {
  getUser(): Promise<{data: {user: {id: string} | null}; error: {message?: string} | null}>;
  getSession(): Promise<{data: {session: {user: {id: string}} | null}; error: {message?: string} | null}>;
 };
 rpc(name: string,args?: Record<string,unknown>): PromiseLike<RpcResult>;
}
export function decodeAdminSession(raw: string | null): AdminSession | null {
 try {
  const value = JSON.parse(raw ?? "null");
  return value && value.epoch === GAME_EPOCH && typeof value.account === "string" && UUID.test(value.account)
   && typeof value.nonce === "string" && UUID.test(value.nonce) ? {account:value.account,nonce:value.nonce,epoch:GAME_EPOCH} : null;
 } catch { return null; }
}
export function gameHeaders(session: AdminSession | null = null): Record<string,string> {
 return {"X-Game-Epoch":String(GAME_EPOCH),...(session ? {"X-Game-Session":session.nonce} : {})};
}
export function policyMessage(message: string): string {
 if (/session_superseded|account_required/.test(message)) return "Your session changed. Sign in again before continuing.";
 if (/update_required/.test(message)) return "This dashboard needs the matching game release.";
 if (/maintenance/.test(message)) return "The game is in maintenance. Try again after it reopens.";
 return "The request could not be completed. Check the result before retrying a reward send.";
}
/** Called only by explicit admin sign-in. Never reclaim a replaced session in rpc(). */
export async function establishAdminSession(client: AdminAdapter,store: SessionStore,attempt: AdminLoginAttempt = beginAdminLogin(store)): Promise<void> {
 assertLoginCurrent(store,attempt);
 const user = await client.auth.getUser();
 assertLoginCurrent(store,attempt);
 if (user.error || !user.data.user) throw new Error("Sign in before opening the dashboard.");
 const account = user.data.user.id;
 const status = await client.rpc("get_app_status");
 assertLoginCurrent(store,attempt);
 const value = status.data as Record<string,unknown> | null;
 if (status.error || !value || value.is_admin !== true) throw new Error("This account is not an admin.");
 if (value.progress_epoch !== GAME_EPOCH) throw new Error(policyMessage("update_required"));
 if (value.maintenance !== false) throw new Error(policyMessage("maintenance"));
 assertLoginCurrent(store,attempt);
 const claimed = await client.rpc("claim_session",{p_platform:"web-admin"});
 assertLoginCurrent(store,attempt);
 if (claimed.error) throw new Error(policyMessage(claimed.error.message ?? ""));
 if (typeof claimed.data !== "string" || !UUID.test(claimed.data)) throw new Error("Session setup was not confirmed. Sign in again.");
 const current = await client.auth.getSession();
 assertLoginCurrent(store,attempt);
 if (current.error || current.data.session?.user.id !== account) throw new Error("Your account changed. Sign in again.");
 store.write({account,nonce:claimed.data,epoch:GAME_EPOCH});
}
export async function adminRpc<T>(client: AdminAdapter,store: SessionStore,name: string,args: Record<string,unknown> = {}): Promise<T> {
 if (!/^admin_[a-z0-9_]+$/.test(name)) throw new Error("Unsupported dashboard request.");
 const context = store.read();
 const generation = store.generation();
 const session = await client.auth.getSession();
 if(store.generation()!==generation)throw new AdminLoginSuperseded();
 if (!context || session.error || session.data.session?.user.id !== context.account) {
  store.clear(); throw new Error("Sign in again before using the dashboard.");
 }
 const result = await client.rpc(name,args);
 const current = await client.auth.getSession();
 const stored = store.read();
 if (store.generation()!==generation || current.error || current.data.session?.user.id !== context.account || stored?.nonce !== context.nonce || stored.epoch !== context.epoch) {
  throw new Error("Your account or session changed. Sign in again.");
 }
 if (result.error) {
  if (/session_superseded|account_required|update_required/.test(result.error.message ?? "")) store.clear();
  throw new Error(policyMessage(result.error.message ?? ""));
 }
 return result.data as T;
}
