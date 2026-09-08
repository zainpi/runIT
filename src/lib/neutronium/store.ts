import { createClient } from "@supabase/supabase-js";
import { Workspace, DomainError } from "./model";
const buckets = [
  "employees",
  "applications",
  "templates",
  "grants",
  "requests",
  "jobs",
  "audit",
  "notifications",
  "integrations",
] as const;
export const developmentEnabled = () =>
  process.env.NODE_ENV === "development" &&
  process.env.NEUTRONIUM_DISABLE_DEMO !== "true";
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new DomainError(
      "Neutronium database is not configured. Set the Supabase service credentials and apply the migration.",
      503,
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function localRoot() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = path.join(process.cwd(), ".neutronium-dev");
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  return { fs, path, root };
}
function validId(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id))
    throw new DomainError("Invalid workspace.", 400);
}
export async function readWorkspace(
  id: string,
  local = false,
): Promise<Workspace> {
  validId(id);
  if (local && developmentEnabled()) {
    const { fs, path, root } = await localRoot();
    try {
      return JSON.parse(
        await fs.readFile(path.join(root, `${id}.json`), "utf8"),
      );
    } catch {
      throw new DomainError(
        "Development workspace expired. Start a new demo.",
        404,
      );
    }
  }
  const { data, error } = await db().rpc("neutronium_load", { p_org: id });
  if (error)
    throw new DomainError(
      "Unable to load workspace. Check database migration and connectivity.",
      503,
    );
  if (!data) throw new DomainError("Workspace not found.", 404);
  return data as Workspace;
}
export async function createWorkspace(
  w: Workspace,
  local = false,
  ownerId?: string,
) {
  if (local && developmentEnabled()) {
    const { fs, path, root } = await localRoot();
    await fs.writeFile(path.join(root, `${w.id}.json`), JSON.stringify(w), {
      mode: 0o600,
      flag: "wx",
    });
    return;
  }
  const { error } = await db().rpc("neutronium_create", {
    p_state: w,
    p_owner: ownerId,
  });
  if (error) throw new DomainError("Could not create organization.", 503);
}
export async function mutate<T>(
  id: string,
  local: boolean,
  fn: (w: Workspace) => T,
): Promise<T> {
  validId(id);
  if (local && developmentEnabled()) {
    const { fs, path, root } = await localRoot();
    const lock = path.join(root, `${id}.lock`);
    let held = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await fs.mkdir(lock);
        held = true;
        break;
      } catch {
        const stat = await fs.stat(lock).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > 30_000)
          await fs.rmdir(lock).catch(() => {});
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    if (!held) throw new DomainError("Workspace is busy. Try again.", 409);
    try {
      const w = await readWorkspace(id, true);
      const value = fn(w);
      w.revision++;
      const tmp = path.join(root, `${id}.${crypto.randomUUID()}.tmp`);
      await fs.writeFile(tmp, JSON.stringify(w), { mode: 0o600 });
      await fs.rename(tmp, path.join(root, `${id}.json`));
      return value;
    } finally {
      await fs.rmdir(lock).catch(() => {});
    }
  }
  for (let i = 0; i < 5; i++) {
    const w = await readWorkspace(id);
    const revision = w.revision;
    const value = fn(w);
    const { data, error } = await db().rpc("neutronium_save", {
      p_org: id,
      p_revision: revision,
      p_state: w,
    });
    if (error) throw new DomainError("Workspace update failed.", 503);
    if (data) return value;
  }
  throw new DomainError(
    "Another update is in progress. Please try again.",
    409,
  );
}
export async function listWorkspaces(
  local = false,
): Promise<{ id: string; name: string; revision: number }[]> {
  if (local && developmentEnabled()) {
    const { fs, root } = await localRoot();
    const files = (await fs.readdir(root)).filter((f) =>
      /^[0-9a-f-]{36}\.json$/.test(f),
    );
    return Promise.all(
      files.map(async (f) => {
        const w = await readWorkspace(f.slice(0, -5), true);
        return { id: w.id, name: w.name, revision: w.revision };
      }),
    );
  }
  const { data, error } = await db()
    .from("neutronium_organizations")
    .select("id,name,revision")
    .limit(500);
  if (error) throw new DomainError("Could not list organizations.", 503);
  return data || [];
}
export { buckets };
