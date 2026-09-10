import { runCommand } from "@/lib/neutronium/command-store";
import {
  createOnboardingLink,
  readInvitation,
  submitApplication,
  listEmployeeApplications,
  revokeOnboardingLink,
  reviewEmployeeApplication,
} from "@/lib/neutronium/employee-applications";
import { joinPath, safeAuthReturn } from "@/lib/neutronium/onboarding-link";
import { serviceRequestContext } from "@/lib/neutronium/pilot-store";
import { readView } from "@/lib/neutronium/read-model";
import {
  mfaStatus,
  resetMfa,
  enrollMfa,
  challengeMfa,
  listSessions,
  revokeSession,
} from "@/lib/neutronium/mfa";
import { syncReadiness, reconcile } from "@/lib/neutronium/microsoft-readiness";
import { evidence } from "@/lib/neutronium/operations";
import { postgres } from "@/lib/neutronium/postgres";
import {
  listServiceRequests,
  mutateServiceRequest,
  readServiceRequest,
} from "@/lib/neutronium/pilot-store";
import { cookies } from "next/headers";
import {
  attachmentFor,
  fileTicket,
  verifyFileTicket,
  sessionBinding,
} from "@/lib/neutronium/files";
import { readPilotReport } from "@/lib/neutronium/pilot-report";
import { currentUser } from "@/lib/neutronium/accounts";
import {
  socialProviders,
  startSocial,
  finishSocial,
} from "@/lib/neutronium/social";
import { syncConnection } from "@/lib/neutronium/connections";
import {
  accountAuth,
  accountById,
  inviteAccount,
} from "@/lib/neutronium/accounts";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import {
  actorFor,
  setDemo,
  sameOrigin,
  appOrigin,
  signOut,
  rateLimit,
} from "@/lib/neutronium/auth";
import {
  db,
  developmentEnabled,
  readWorkspace,
  createWorkspace,
  mutate,
  listWorkspaces,
} from "@/lib/neutronium/store";
import {
  Actor,
  DomainError,
  seed,
  uid,
  project,
  canAdmin,
  requireRole,
  admins,
  platformRoles,
  audit,
  fullName,
  now,
} from "@/lib/neutronium/model";
import { tick, deliverNotifications } from "@/lib/neutronium/worker";
import {
  microsoftFeatures,
  microsoftToken,
  storeToken,
  MicrosoftProvider,
  Feature,
} from "@/lib/neutronium/providers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function fail(e: unknown) {
  return json(
    {
      error:
        e instanceof DomainError
          ? e.message
          : "An unexpected error occurred. Please try again.",
    },
    e instanceof DomainError ? e.status : 500,
  );
}
async function body(req: Request) {
  const raw = await req.text();
  if (raw.length > 100_000) throw new DomainError("Request too large.", 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("object required");
    return value;
  } catch {
    throw new DomainError("Invalid JSON.");
  }
}
export async function GET(req: NextRequest, ctx: Context) {
  try {
    const path = (await ctx.params).path.join("/");
    if (path === "config")
      return json({
        socialProviders: socialProviders(),
        demoAvailable: developmentEnabled(),
        authConfigured: !!process.env.NEUTRONIUM_DATABASE_URL,
        microsoftFeatures,
      });
    if (path === "auth/mfa") return json(await mfaStatus());
    if (path === "auth/sessions")
      return json({ sessions: await listSessions() });
    if (path === "auth/status") return json({ user: await currentUser() });
    if (path === "onboarding/invitation") {
      await rateLimit(
        `join-preview:${req.headers.get("x-forwarded-for") || "unknown"}`,
        120,
        60,
      );
      return json(
        await readInvitation(
          req.nextUrl.searchParams.get("token") || "",
          await currentUser(),
        ),
      );
    }
    if (path.startsWith("auth/social/") && path.endsWith("/callback")) {
      try {
        const result = await finishSocial(
          path.split("/")[2],
          appOrigin(req),
          req.nextUrl.searchParams.get("state") || "",
          req.nextUrl.searchParams.get("code") || "",
        );
        return NextResponse.redirect(
          new URL(`/neutronium/?auth=${result || "ready"}`, appOrigin(req)),
        );
      } catch (e) {
        const url = new URL("/neutronium/", appOrigin(req));
        url.searchParams.set(
          "authError",
          e instanceof DomainError
            ? e.message
            : "Provider sign-in failed. Try again.",
        );
        return NextResponse.redirect(url);
      }
    }
    if (path === "auth/confirm") {
      const destination = new URL("/neutronium/", appOrigin(req));
      try {
        const token_hash = req.nextUrl.searchParams.get("token_hash");
        const type = req.nextUrl.searchParams.get("type");
        if (
          !token_hash ||
          token_hash.length > 256 ||
          !["invite", "signup", "recovery", "email"].includes(type || "")
        )
          throw new DomainError(
            "This confirmation link is incomplete or invalid. Open the full link from your latest Neutronium email.",
          );
        const { error, returnTo } = await (
          await accountAuth()
        ).auth.verifyOtp({
          token_hash,
          type: type as "invite" | "signup" | "recovery" | "email",
        });
        if (error)
          throw new DomainError(
            "This confirmation link has expired or was already used. Try signing in if you already confirmed your email. Otherwise, create your account again with the same email to request a new confirmation, or ask your administrator for a new invitation.",
            401,
          );
        const target = new URL(safeAuthReturn(returnTo), appOrigin(req));
        destination.pathname = target.pathname;
        destination.search = target.search;
      } catch (e) {
        destination.searchParams.set(
          "authError",
          e instanceof DomainError
            ? e.message
            : "We couldn’t confirm your email right now. Please try the link again in a few minutes.",
        );
      }
      const response = NextResponse.redirect(destination);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
    if (path === "microsoft/callback") {
      const a = await actorFor();
      requireRole(a, admins);
      if (a.demo)
        throw new DomainError(
          "Use a production organization for Microsoft consent.",
        );
      const state = req.nextUrl.searchParams.get("state") || "";
      const hash = createHash("sha256").update(state).digest("hex");
      const { data, error } = await db()
        .from("neutronium_oauth_states")
        .delete()
        .eq("id", hash)
        .eq("user_id", a.id)
        .eq("organization_id", a.orgId)
        .gt("expires_at", now())
        .select()
        .maybeSingle();
      if (error || !data)
        throw new DomainError(
          "Microsoft connection request expired or was already used.",
          403,
        );
      if (
        req.nextUrl.searchParams.get("admin_consent")?.toLowerCase() !==
          "true" ||
        req.nextUrl.searchParams.get("tenant") !== data.tenant_id
      )
        throw new DomainError(
          "Microsoft consent was declined or the tenant did not match.",
          403,
        );
      const token = await microsoftToken(data.tenant_id);
      const features = (data.features as Feature[]).filter((f) =>
        microsoftFeatures[f].permissions.every((p) => token.roles.includes(p)),
      );
      if (features.length !== (data.features as string[]).length)
        throw new DomainError(
          "Microsoft consent did not include every requested feature.",
        );
      await storeToken(a.orgId, token);
      await mutate(a.orgId, false, (w) => {
        const i = w.integrations[0];
        i.status = "connected";
        i.tenantId = data.tenant_id;
        i.features = features;
        i.checkedAt = now();
        audit(
          w,
          a,
          "Microsoft tenant connected",
          i.provider,
          uid(),
          undefined,
          { tenant: data.tenant_id, features },
        );
      });
      return NextResponse.redirect(
        new URL("/neutronium/?view=integrations&connected=1", appOrigin(req)),
      );
    }
    const a = await actorFor(req.nextUrl.searchParams.get("org") || undefined);
    if (path === "onboarding/applications")
      return json(await listEmployeeApplications(a, req.nextUrl.searchParams));
    if (path === "employees/export") {
      requireRole(a, [...admins, "HR_ADMIN"]);
      const w = await readWorkspace(a.orgId, a.demo);
      const fields = [
        "firstName",
        "lastName",
        "email",
        "title",
        "department",
        "location",
        "status",
        "startDate",
      ] as const;
      const cell = (v: string) =>
        '"' +
        (/^[=+@\-\t\r\n]/.test(v) ? "'" : "") +
        v.replace(/"/g, '""') +
        '"';
      const csv = [
        fields.join(","),
        ...w.employees.map((e) => fields.map((k) => cell(e[k])).join(",")),
      ].join("\r\n");
      await mutate(a.orgId, a.demo, (state) =>
        audit(
          state,
          a,
          "Employee inventory exported",
          state.name,
          uid(),
          undefined,
          { count: w.employees.length },
        ),
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=employees.csv",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path === "operations/context")
      return json(
        await serviceRequestContext(
          a,
          req.nextUrl.searchParams.get("id") || "",
        ),
      );
    if (path === "operations")
      return json(await listServiceRequests(a, req.nextUrl.searchParams));
    if (path === "session") return json({ actor: a });
    if (path === "pilot/report") {
      requireRole(a, admins);
      return json(await readPilotReport(a));
    }
    if (path === "files/download") {
      const jar = await cookies();
      const binding = sessionBinding(
        jar.get(a.demo ? "neutronium_demo" : "neutronium_session")?.value || "",
      );
      const link = verifyFileTicket(
        req.nextUrl.searchParams.get("ticket") || "",
        a,
        binding,
      );
      const file = await attachmentFor(
        await readServiceRequest(a, link.requestId),
        a,
        link.requestId,
        link.messageId,
      );
      return new NextResponse(new Uint8Array(file.bytes), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox",
        },
      });
    }
    if (path === "companies") {
      requireRole(a, platformRoles);
      let all = a.demo
        ? [{ id: a.orgId, name: "Acme Inc." }]
        : await listWorkspaces();
      if (!a.demo && a.role !== "PLATFORM_OWNER") {
        const { data, error } = await db()
          .from("neutronium_platform_scopes")
          .select("organization_id")
          .eq("user_id", a.id);
        if (error)
          throw new DomainError("Operator assignments unavailable.", 503);
        const ids = new Set(
          (data || []).map(
            (s: { organization_id: string }) => s.organization_id,
          ),
        );
        all = all.filter((o) => ids.has(o.id));
      }
      const companies = await Promise.all(
        all.map(async (o) => {
          const w = await readWorkspace(o.id, a.demo);
          return {
            id: w.id,
            name: w.name,
            employees: w.employees.length,
            subscription: w.subscription,
            status: w.integrations[0]?.status,
            failedJobs: w.jobs.filter((j) => j.status === "failed").length,
            pendingRequests: w.requests.filter((r) => r.status === "pending")
              .length,
          };
        }),
      );
      return json({ companies });
    }
    if (path === "state") {
      if (platformRoles.includes(a.role))
        await mutate(a.orgId, a.demo, (w) =>
          audit(w, a, "Operator inspected workspace", w.name, uid()),
        );
      const workspace = await readView(a, req.nextUrl.searchParams);
      return json({ actor: a, workspace });
    }
    throw new DomainError("Not found.", 404);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest, ctx: Context) {
  try {
    const path = (await ctx.params).path.join("/");
    if (path === "worker") {
      const secret = process.env.NEUTRONIUM_CRON_SECRET;
      const provided =
        req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
      const trusted =
        !!secret &&
        provided.length === secret.length &&
        timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
      if (!trusted) {
        sameOrigin(req);
        const a = await actorFor();
        if (!a.demo)
          throw new DomainError("Worker authentication required.", 401);
        await tick(a.orgId, true);
        return json({ ok: true });
      }
      const batch = await postgres().connect();
      let organizations: Awaited<ReturnType<typeof listWorkspaces>>;
      try {
        await batch.query("begin");
        const { rows } = await batch.query(
          "select after_id from neutronium_worker_cursor where id=true for update",
        );
        organizations = await listWorkspaces(
          false,
          rows[0]?.after_id || undefined,
        );
        if (!organizations.length && rows[0]?.after_id)
          organizations = await listWorkspaces();
        await batch.query("commit");
      } catch (e) {
        await batch.query("rollback");
        throw e;
      } finally {
        batch.release();
      }
      const failed: string[] = [];
      const started = Date.now();
      let processed = 0;
      for (const o of organizations) {
        if (processed >= 20 || Date.now() - started > 40000) break;
        try {
          for (let i = 0; i < 3 && Date.now() - started < 40000; i++)
            if (!(await tick(o.id))) break;
          await deliverNotifications(o.id);
        } catch {
          failed.push(o.id);
        }
        processed++;
        await postgres().query(
          "update neutronium_worker_cursor set after_id=$1 where id=true",
          [o.id],
        );
      }
      return json(
        { ok: !failed.length, organizations: processed, failed },
        failed.length ? 503 : 200,
      );
    }
    sameOrigin(req);
    const input = await body(req);
    if (path === "onboarding/apply") {
      const user = await currentUser();
      if (!user)
        throw new DomainError(
          "Sign in and confirm your email before submitting your details.",
          401,
        );
      if (user.mfa_required && !user.mfa_verified_at)
        throw new DomainError(
          "Verify your authenticator code before continuing.",
          403,
        );
      await rateLimit(`join-apply:${user.id}`, 10, 60);
      return json({
        application: await submitApplication(
          String(input.token || ""),
          user,
          input,
        ),
      });
    }
    if (path === "auth/mfa/reset") {
      await resetMfa(String(input.token || ""));
      return json({ ok: true });
    }
    if (path === "auth/mfa/enroll") return json(await enrollMfa());
    if (path === "auth/mfa/challenge")
      return json(await challengeMfa(String(input.token || "")));
    if (path === "auth/sessions/revoke") {
      await revokeSession(String(input.id));
      return json({ ok: true });
    }
    if (path === "auth/social") {
      await rateLimit(
        `social:${req.headers.get("x-forwarded-for") || "unknown"}`,
        20,
        60,
      );
      return json({
        url: await startSocial(
          String(input.provider),
          appOrigin(req),
          String(input.signupRole),
        ),
      });
    }
    if (path === "demo") {
      if (!developmentEnabled())
        throw new DomainError(
          "The development adapter is disabled on this server.",
          403,
        );
      const w = seed();
      await createWorkspace(w, true);
      const a: Actor = {
        id: "demo-owner",
        name: "Jamie Morgan",
        role: "ORG_OWNER",
        orgId: w.id,
        demo: true,
      };
      await setDemo(a);
      return json({ actor: a, workspace: project(w, a) });
    }
    if (path === "login" || path === "signup") {
      await rateLimit(
        `auth:${req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown"}`,
        10,
        60,
      );
      if (
        typeof input.email !== "string" ||
        typeof input.password !== "string" ||
        input.password.length > 128 ||
        (path === "signup"
          ? input.password.length < 12
          : !input.password.length)
      )
        throw new DomainError(
          "Enter a valid email and password. New passwords need at least 12 characters.",
        );
      await rateLimit(`auth-email:${input.email.trim().toLowerCase()}`, 10, 60);
      const auth = await accountAuth();
      let returnTo: string | undefined;
      if (path === "signup" && input.joinToken) {
        returnTo = joinPath(input.joinToken);
        if (!(await readInvitation(input.joinToken)).available)
          throw new DomainError(
            "This invitation is no longer available. Sign in to check an existing application, or ask your administrator for a new link.",
            410,
          );
      }
      const result =
        path === "signup"
          ? await auth.auth.signUp({
              email: input.email,
              password: input.password,
              signupRole: returnTo ? "employee" : input.signupRole,
              returnTo,
            })
          : await auth.auth.signInWithPassword({
              email: input.email,
              password: input.password,
            });
      if (result.error)
        throw new DomainError(
          path === "login"
            ? "We couldn’t sign you in. Check your email and password, and confirm your email using the link we sent before signing in."
            : "Account creation failed. Check your email or try signing in.",
          400,
        );
      return json({ ok: true, confirmationRequired: !result.data.session });
    }
    if (path === "logout") {
      await signOut();
      return json({ ok: true });
    }
    if (path === "organization") {
      const {
        data: { user },
      } = await (await accountAuth()).auth.getUser();
      if (!user) throw new DomainError("Sign in first.", 401);
      await rateLimit(`create:${user.id}`, 3, 3600);
      if (
        typeof input.name !== "string" ||
        !input.name.trim() ||
        input.name.length > 100
      )
        throw new DomainError(
          "Enter your organization’s name, using 100 characters or fewer.",
        );
      const w = seed(uid(), false, input.name.trim());
      audit(
        w,
        {
          id: user.id,
          name: user.email || "Organization owner",
          orgId: w.id,
          role: "ORG_OWNER",
          demo: false,
        },
        "Organization created",
        w.name,
        uid(),
      );
      await createWorkspace(w, false, user.id);
      return json({ id: w.id });
    }
    const a = await actorFor(
      typeof input.orgId === "string" ? input.orgId : undefined,
    );
    await rateLimit(`commands:${a.id}`, 120, 60);
    if (path === "onboarding/link") {
      const link = await createOnboardingLink(a);
      return json({
        ...link,
        url: new URL(link.path, appOrigin(req)).toString(),
      });
    }
    if (path === "onboarding/revoke-link") {
      await revokeOnboardingLink(a, String(input.id || ""));
      return json({ ok: true });
    }
    if (path === "onboarding/review")
      return json({ application: await reviewEmployeeApplication(a, input) });
    if (path === "microsoft/readiness") {
      await syncReadiness(a);
      return json({ ok: true });
    }
    if (path === "microsoft/reconcile") {
      await reconcile(a);
      return json({ ok: true });
    }
    if (path === "mailbox/verify") {
      requireRole(a, admins);
      await mutate(a.orgId, a.demo, (w) => {
        const e = w.employees.find((e) => e.id === input.employeeId);
        if (!e?.providerId)
          throw new DomainError("Match or create a Microsoft identity first.");
        const proof = evidence(a, {
          ...input,
          provider: "Exchange Online",
          target: e.email,
        });
        e.mailbox = { status: "manually_verified", evidence: proof };
        audit(w, a, "Mailbox manually verified", e.id, uid(), undefined, {
          evidence: proof,
        });
      });
      return json({ ok: true });
    }
    if (path === "files/link") {
      const requestId = String(input.requestId),
        messageId = String(input.messageId);
      await attachmentFor(
        await readServiceRequest(a, requestId),
        a,
        requestId,
        messageId,
      );
      const jar = await cookies();
      const binding = sessionBinding(
        jar.get(a.demo ? "neutronium_demo" : "neutronium_session")?.value || "",
      );
      return json({
        url: `/neutronium/api/files/download?ticket=${encodeURIComponent(fileTicket(a, requestId, messageId, binding))}`,
      });
    }
    if (path === "password") {
      if (a.demo)
        throw new DomainError("Development personas do not have passwords.");
      if (
        typeof input.password !== "string" ||
        input.password.length < 12 ||
        input.password.length > 128
      )
        throw new DomainError("Use a password between 12 and 128 characters.");
      const { error } = await (
        await accountAuth()
      ).auth.updateUser({ password: input.password });
      if (error)
        throw new DomainError(
          "Password update failed. Sign in again and retry.",
        );
      await mutate(a.orgId, false, (w) =>
        audit(w, a, "Account password updated", a.employeeId || a.id, uid()),
      );
      return json({ ok: true });
    }
    if (path === "persona") {
      if (!a.demo)
        throw new DomainError(
          "Persona switching is only available in development.",
          403,
        );
      const w = await readWorkspace(a.orgId, true);
      let next: Actor = {
        id: "demo-owner",
        name: "Jamie Morgan",
        role: "ORG_OWNER",
        orgId: a.orgId,
        demo: true,
      };
      if (input.persona === "platform")
        next = {
          ...next,
          id: "demo-operator",
          name: "Platform operator",
          role: "PLATFORM_OWNER",
        };
      else if (input.persona === "employee" || input.persona === "manager") {
        const e =
          w.employees.find((e) => e.id === input.employeeId) ||
          w.employees[input.persona === "manager" ? 1 : 0];
        if (!e || e.status === "terminated")
          throw new DomainError("Choose an available employee.");
        next = {
          ...next,
          id: `demo-${e.id}`,
          name: fullName(e),
          employeeId: e.id,
          role: input.persona === "manager" ? "MANAGER" : "EMPLOYEE",
        };
      } else if (input.persona !== "admin")
        throw new DomainError("Invalid persona.");
      await setDemo(next);
      return json({ actor: next, workspace: project(w, next) });
    }
    if (path === "microsoft/connect") {
      requireRole(a, admins);
      if (a.demo)
        throw new DomainError(
          "Development workspaces cannot connect a real tenant.",
        );
      const tenant = String(input.tenantId || "");
      if (!/^[0-9a-f-]{36}$/i.test(tenant))
        throw new DomainError("Enter your Microsoft tenant ID.");
      const clientId = process.env.NEUTRONIUM_MICROSOFT_CLIENT_ID;
      if (!clientId)
        throw new DomainError("Microsoft OAuth is not configured.", 503);
      const features = Array.isArray(input.features)
        ? input.features.filter(
            (f: unknown) => typeof f === "string" && f in microsoftFeatures,
          )
        : [];
      if (!features.length)
        throw new DomainError("Select at least one feature.");
      const state = randomBytes(32).toString("base64url");
      const { error } = await db()
        .from("neutronium_oauth_states")
        .insert({
          id: createHash("sha256").update(state).digest("hex"),
          organization_id: a.orgId,
          user_id: a.id,
          tenant_id: tenant,
          features,
          expires_at: new Date(Date.now() + 600_000).toISOString(),
        });
      if (error)
        throw new DomainError("Could not start Microsoft connection.", 503);
      const url = new URL(
        `https://login.microsoftonline.com/${tenant}/v2.0/adminconsent`,
      );
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${appOrigin(req)}/neutronium/api/microsoft/callback`,
        scope: "https://graph.microsoft.com/.default",
        state,
      }).toString();
      return json({ url: url.toString() });
    }
    if (path === "connections/connect" || path === "connections/sync") {
      return json({
        count: await syncConnection(
          a,
          String(input.provider),
          path.endsWith("connect") ? input : undefined,
        ),
      });
    }
    if (path === "security/sync") {
      requireRole(a, admins);
      const w = await readWorkspace(a.orgId, a.demo);
      let alerts = [];
      if (a.demo)
        alerts = [
          {
            id: "demo-risk",
            email: w.employees[0]?.email || "test@example.invalid",
            level: "high",
            state: "atRisk",
            detail: "Simulated compromised account — test data",
            at: now(),
          },
        ];
      else {
        const provider = new MicrosoftProvider(w);
        let page = "/identityProtection/riskyUsers?$top=100";
        do {
          const data = await provider.graph(page, "security");
          alerts.push(
            ...data.value.map((r: Record<string, string>) => ({
              id: r.id,
              email: r.userPrincipalName,
              level: r.riskLevel,
              state: r.riskState,
              detail: r.riskDetail,
              at: r.riskLastUpdatedDateTime,
            })),
          );
          const next = data["@odata.nextLink"];
          if (
            next &&
            !next.startsWith(
              "https://graph.microsoft.com/v1.0/identityProtection/riskyUsers?",
            )
          )
            throw new DomainError("Unexpected security pagination URL.");
          page = next
            ? next.replace("https://graph.microsoft.com/v1.0", "")
            : "";
          if (alerts.length > 5000)
            throw new DomainError("Security inventory exceeds 5000 accounts.");
        } while (page);
      }
      await mutate(a.orgId, a.demo, (state) => {
        state.securityAlerts = alerts;
        state.securityCheckedAt = now();
        audit(
          state,
          a,
          "Account risk synchronized",
          state.name,
          uid(),
          undefined,
          { count: alerts.length },
        );
      });
      return json({ count: alerts.length });
    }
    if (path === "microsoft/sync") {
      requireRole(a, admins);
      if (a.demo)
        throw new DomainError(
          "Development data is already local. Connect a production organization to import Microsoft accounts.",
        );
      const w = await readWorkspace(a.orgId);
      const provider = new MicrosoftProvider(w);
      let page =
        "/users?$select=id,givenName,surname,userPrincipalName,jobTitle,department&$top=100";
      const accounts: {
        id: string;
        userPrincipalName: string;
        givenName?: string;
        surname?: string;
        jobTitle?: string;
        department?: string;
      }[] = [];
      do {
        const result = await provider.graph(page, "inventory");
        accounts.push(...result.value);
        const next = result["@odata.nextLink"];
        if (next && !next.startsWith("https://graph.microsoft.com/v1.0/users?"))
          throw new DomainError("Unexpected Microsoft pagination URL.");
        page = next ? next.replace("https://graph.microsoft.com/v1.0", "") : "";
        if (accounts.length > 5000)
          throw new DomainError(
            "This tenant requires a paginated import beyond the MVP limit.",
          );
      } while (page);
      await mutate(a.orgId, false, (state) => {
        for (const account of accounts) {
          const e = state.employees.find(
            (e) =>
              e.email.toLowerCase() === account.userPrincipalName.toLowerCase(),
          );
          if (e) {
            if (e.providerId && e.providerId !== account.id) continue;
            e.providerId = account.id;
          } else
            state.employees.push({
              id: uid(),
              email: account.userPrincipalName.toLowerCase(),
              firstName:
                account.givenName || account.userPrincipalName.split("@")[0],
              lastName: account.surname || "",
              title: account.jobTitle || "",
              department: account.department || "Unassigned",
              personalEmail: "",
              managerId: "",
              startDate: now().slice(0, 10),
              location: "",
              employmentType: "Full-time",
              status: "active",
              providerId: account.id,
              createdAt: now(),
            });
        }
        state.integrations[0].checkedAt = now();
        audit(
          state,
          a,
          "Microsoft account inventory synchronized",
          state.name,
          uid(),
          undefined,
          { count: accounts.length },
        );
      });
      return json({ count: accounts.length });
    }
    if (path === "invite") {
      requireRole(a, admins);
      if (a.demo)
        throw new DomainError(
          "Use the persona selector to try employee sign-in in development.",
        );
      const w = await readWorkspace(a.orgId);
      const e = w.employees.find((e) => e.id === input.employeeId);
      if (!e || e.status === "terminated")
        throw new DomainError("Employee is not available.");
      const role = String(input.role || "EMPLOYEE");
      if (
        !["EMPLOYEE", "MANAGER", "APPROVER", "HR_ADMIN", "ORG_ADMIN"].includes(
          role,
        )
      )
        throw new DomainError("Invalid membership role.");
      if (role === "ORG_ADMIN" && a.role !== "ORG_OWNER")
        throw new DomainError(
          "Only the organization owner can assign administrators.",
          403,
        );
      let userId: string;
      if (input.userId) {
        const user = await accountById(String(input.userId));
        if (!user || user.email.toLowerCase() !== e.email.toLowerCase())
          throw new DomainError(
            "The supplied user does not match the employee email.",
          );
        userId = user.id;
      } else {
        userId = (await inviteAccount(e.email)).id;
      }
      const { data: existingMember } = await db()
        .from("neutronium_memberships")
        .select("role")
        .eq("organization_id", a.orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (
        existingMember?.role === "ORG_OWNER" ||
        (existingMember?.role === "ORG_ADMIN" && a.role !== "ORG_OWNER")
      )
        throw new DomainError(
          "This invitation cannot change an existing owner or administrator membership.",
          403,
        );
      const { error } = await db().from("neutronium_memberships").upsert({
        organization_id: a.orgId,
        user_id: userId,
        employee_id: e.id,
        role,
        active: true,
      });
      if (error)
        throw new DomainError(
          "Invitation sent, but membership assignment failed. Retry with the existing user ID.",
          503,
        );
      await mutate(a.orgId, false, (state) =>
        audit(
          state,
          a,
          "Employee portal membership assigned",
          e.id,
          uid(),
          undefined,
          { role },
        ),
      );
      return json({ ok: true });
    }
    if (
      [
        "help-create",
        "help-reply",
        "operation-update",
        "operation-note",
        "operation-task",
        "checklist-template",
        "saved-view",
      ].includes(path)
    )
      return json({
        ok: true,
        result: await mutateServiceRequest(a, path, input),
      });
    const result = await runCommand(a, path, input);
    return json({ ok: true, result });
  } catch (e) {
    return fail(e);
  }
}
