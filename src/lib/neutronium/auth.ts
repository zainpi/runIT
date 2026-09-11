import { tenantQuery } from "./postgres";
import { cookies } from "next/headers";
import { accountAuth } from "./accounts";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { Actor, DomainError, Role, platformRoles } from "./model";
import { db, developmentEnabled, readWorkspace } from "./store";
import { isUuid } from "./validation";
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
export async function actorFor(orgId?: string): Promise<Actor> {
  if (orgId && !isUuid(orgId)) throw new DomainError("Invalid workspace ID.");
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
  const client = await accountAuth();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new DomainError("Sign in to continue.", 401);
  if (user.mfa_required && !user.mfa_verified_at)
    throw new DomainError(
      "Complete multi-factor authentication to continue.",
      403,
    );
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
    const record = await tenantQuery(
      member.organization_id,
      "select payload,exists(select 1 from neutronium_jobs where organization_id=$1 and employee_id=$2 and payload->>'kind'='offboard' and (payload->>'scheduledAt')::timestamptz<=now()) as offboard_due from neutronium_employees where organization_id=$1 and id=$2",
      [member.organization_id, member.employee_id],
    );
    const employee = record.rows[0]?.payload;
    const offboardDue = record.rows[0]?.offboard_due;
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
  await (await accountAuth()).auth.signOut();
  (await cookies()).set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/neutronium",
    maxAge: 0,
  });
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
    p_key: createHmac(
      "sha256",
      process.env.NEUTRONIUM_CRON_SECRET ||
        (() => {
          throw new DomainError("Configure NEUTRONIUM_CRON_SECRET.", 503);
        })(),
    )
      .update(key)
      .digest("hex"),
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error)
    throw new DomainError(
      "Neutronium is temporarily unavailable. Please try again shortly.",
      503,
    );
  if (!data)
    throw new DomainError(
      "Too many attempts. Please try again shortly.",
      429,
      seconds * 1000,
    );
}
