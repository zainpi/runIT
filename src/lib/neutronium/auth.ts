import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { Actor, DomainError, Role, platformRoles } from "./model";
import { db, developmentEnabled, readWorkspace } from "./store";
const cookieName = "neutronium_demo";
let ephemeralKey: string | undefined;
async function demoKey() {
  if (ephemeralKey) return ephemeralKey;
  const fs = await import("node:fs/promises");
  const dir = `${process.cwd()}/.neutronium-dev`;
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(`${dir}/.session-key`, randomBytes(32).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  ephemeralKey = await fs.readFile(`${dir}/.session-key`, "utf8");
  return ephemeralKey;
}
export async function setDemo(actor: Actor) {
  if (!developmentEnabled())
    throw new DomainError("Development mode is disabled.", 403);
  const payload = Buffer.from(
    JSON.stringify({ ...actor, exp: Date.now() + 8 * 3600_000 }),
  ).toString("base64url");
  const sig = createHmac("sha256", await demoKey())
    .update(payload)
    .digest("base64url");
  (await cookies()).set(cookieName, `${payload}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/neutronium",
    maxAge: 8 * 3600,
  });
}
export async function supabaseAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new DomainError("Authentication is not configured.", 503);
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) =>
        values.forEach((c) =>
          jar.set(c.name, c.value, {
            ...c.options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          }),
        ),
    },
  });
}
export async function actorFor(orgId?: string): Promise<Actor> {
  const jar = await cookies();
  const signed = jar.get(cookieName)?.value;
  if (signed && developmentEnabled()) {
    const [payload, sig] = signed.split(".");
    const expected = createHmac("sha256", await demoKey())
      .update(payload)
      .digest();
    const provided = Buffer.from(sig || "", "base64url");
    if (
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    ) {
      const a = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (a.exp > Date.now()) {
        if (orgId && orgId !== a.orgId)
          throw new DomainError("Workspace not found.", 404);
        await readWorkspace(a.orgId, true);
        return a;
      }
    }
  }
  const client = await supabaseAuth();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new DomainError("Sign in to continue.", 401);
  const { data: platform } = await db()
    .from("neutronium_platform_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (platform && platformRoles.includes(platform.role as Role)) {
    if (!orgId)
      return {
        id: user.id,
        name: user.email || "Operator",
        orgId: "",
        role: platform.role,
        demo: false,
      };
    if (platform.role !== "PLATFORM_OWNER") {
      const { data: scope } = await db()
        .from("neutronium_platform_scopes")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!scope)
        throw new DomainError(
          "This company is not assigned to your support account.",
          403,
        );
    }
    await readWorkspace(orgId);
    const actor = {
      id: user.id,
      name: user.email || "Operator",
      orgId,
      role: platform.role as Role,
      demo: false,
    };
    return actor;
  }
  let query = db()
    .from("neutronium_memberships")
    .select("organization_id,role,employee_id")
    .eq("user_id", user.id)
    .eq("active", true);
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query.order("created_at").limit(1);
  if (error) throw new DomainError("Membership lookup failed.", 503);
  const member = data?.[0];
  if (!member)
    throw new DomainError(
      "Create an organization or ask your administrator for an invitation.",
      403,
    );
  if (member.employee_id) {
    const workspace = await readWorkspace(member.organization_id);
    const employee = workspace.employees.find(
      (e) => e.id === member.employee_id,
    );
    const offboardDue = workspace.jobs.some(
      (j) =>
        j.employeeId === member.employee_id &&
        j.kind === "offboard" &&
        Date.parse(j.scheduledAt) <= Date.now(),
    );
    if (!employee || employee.status === "terminated" || offboardDue)
      throw new DomainError("Your employee portal access has ended.", 403);
  }
  return {
    id: user.id,
    name: user.email || "Member",
    orgId: member.organization_id,
    role: member.role,
    employeeId: member.employee_id || undefined,
    demo: false,
  };
}
export async function signOut() {
  (await cookies()).delete(cookieName);
  try {
    await (await supabaseAuth()).auth.signOut();
  } catch {
    /* demo has no Supabase session */
  }
}
export function appOrigin(request: Request) {
  const configured = process.env.NEUTRONIUM_APP_URL;
  return configured
    ? new URL(configured).origin
    : `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== appOrigin(request))
    throw new DomainError("Request origin did not match.", 403);
}
export async function rateLimit(key: string, limit = 20, seconds = 60) {
  if (developmentEnabled()) return;
  const { data, error } = await db().rpc("neutronium_rate_limit", {
    p_key: createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
      .update(key)
      .digest("hex"),
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error || !data)
    throw new DomainError("Too many attempts. Please try again shortly.", 429);
}
