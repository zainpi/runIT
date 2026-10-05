import { createClient, adminSessionStore } from "./client";
import { adminRpc } from "./release-contract";

/** Calls a Postgres RPC and throws a readable Error on failure.
 *  Authorization is enforced in the database: every admin_* function
 *  re-checks is_admin() before doing anything. */
export async function rpc<T = unknown>(
  fn: string,
  args?: Record<string, unknown>
): Promise<T> {
  return await adminRpc<T>(createClient(), adminSessionStore, fn, args ?? {});
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat().format(v);
}
