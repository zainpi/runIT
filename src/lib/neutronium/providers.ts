import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  DomainError,
  Employee,
  Workspace,
  Application,
  Job,
  Step,
  fullName,
} from "./model";
import { db } from "./store";
export const microsoftFeatures = {
  inventory: {
    name: "Account inventory",
    permissions: ["User.Read.All"],
    reason: "Read company accounts and match existing employees.",
  },
  provisioning: {
    name: "Employee provisioning",
    permissions: ["User.Create", "User.Read.All"],
    reason:
      "Create identities and safely detect accounts already created by an earlier attempt.",
  },
  groups: {
    name: "Application and group access",
    permissions: ["GroupMember.ReadWrite.All"],
    reason:
      "Add or remove members of configured, non-privileged security groups.",
  },
  licenses: {
    name: "License assignment",
    permissions: ["LicenseAssignment.ReadWrite.All"],
    reason: "Assign the Microsoft license selected in an employee template.",
  },
  offboarding: {
    name: "Disable sign-in and end sessions",
    permissions: [
      "User.EnableDisableAccount.All",
      "User.Read.All",
      "User.RevokeSessions.All",
    ],
    reason:
      "Block account sign-in and revoke refresh sessions during offboarding.",
  },
} as const;
export type Feature = keyof typeof microsoftFeatures;
// Microsoft's employeeId field allows at most 16 characters.
export const microsoftWorkflowMarker = (key: string) =>
  `N${createHash("sha256").update(key).digest("hex").slice(0, 15)}`;
export interface ProviderResult {
  status: "success" | "manual_required" | "skipped";
  reference?: string;
  note?: string;
}
export interface IdentityProvider {
  createIdentity(employee: Employee, key: string): Promise<ProviderResult>;
  disable(employee: Employee): Promise<ProviderResult>;
  revokeSessions(employee: Employee): Promise<ProviderResult>;
}
export interface EmailProvider {
  provisionMailbox(employee: Employee): Promise<ProviderResult>;
  preserveMailbox(employee: Employee): Promise<ProviderResult>;
}
export interface ApplicationProvider {
  grant(
    employee: Employee,
    app: Application,
    level: string,
    key: string,
  ): Promise<ProviderResult>;
  revoke(
    employee: Employee,
    app: Application,
    reference?: string,
  ): Promise<ProviderResult>;
}
export interface HRProvider {
  importEmployees(
    cursor?: string,
  ): Promise<{ employees: Partial<Employee>[]; cursor?: string }>;
}
export interface DeviceProvider {
  revokeAccess(employee: Employee): Promise<ProviderResult>;
}
export interface CalendarProvider {
  scheduleMeeting(employee: Employee, start: string): Promise<ProviderResult>;
}
function encryptionKey(version: string) {
  const keys = JSON.parse(
    process.env.NEUTRONIUM_ENCRYPTION_KEYS || "{}",
  ) as Record<string, string>;
  const key = Buffer.from(keys[version] || "", "base64");
  if (key.length !== 32)
    throw new DomainError("Credential encryption key is not configured.", 503);
  return key;
}
export function encrypt(value: unknown, orgId: string) {
  const version = process.env.NEUTRONIUM_ACTIVE_KEY_VERSION || "v1";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(version), iv);
  cipher.setAAD(Buffer.from(orgId));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return {
    ciphertext: Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString(
      "base64",
    ),
    key_version: version,
  };
}
export function decrypt(ciphertext: string, version: string, orgId: string) {
  const bytes = Buffer.from(ciphertext, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(version),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from(orgId));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      cipher.update(bytes.subarray(28)),
      cipher.final(),
    ]).toString(),
  );
}
export async function microsoftToken(
  tenantId: string,
): Promise<{ access_token: string; expires_in: number; roles: string[] }> {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId))
    throw new DomainError("Invalid Microsoft tenant identifier.");
  const clientId = process.env.NEUTRONIUM_MICROSOFT_CLIENT_ID,
    secret = process.env.NEUTRONIUM_MICROSOFT_CLIENT_SECRET;
  if (!clientId || !secret)
    throw new DomainError(
      "Microsoft application credentials are not configured.",
      503,
    );
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new DomainError(
      `Microsoft token exchange failed (${response.status}). Verify tenant consent and application credentials.`,
      502,
    );
  const result = await response.json();
  // Token is obtained directly over TLS from Microsoft's token endpoint, never from a client.
  const claims = JSON.parse(
    Buffer.from(result.access_token.split(".")[1], "base64url").toString(),
  );
  if (claims.tid !== tenantId || !Array.isArray(claims.roles))
    throw new DomainError(
      "Microsoft returned an unexpected tenant or missing application permissions.",
      502,
    );
  return { ...result, roles: claims.roles };
}
export async function storeToken(
  orgId: string,
  token: { access_token: string; expires_in: number },
) {
  const encrypted = encrypt(
    {
      token: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    },
    orgId,
  );
  const { error } = await db()
    .from("neutronium_credentials")
    .upsert({
      organization_id: orgId,
      provider: "microsoft",
      ...encrypted,
      updated_at: new Date().toISOString(),
    });
  if (error)
    throw new DomainError(
      "Could not securely store Microsoft connection.",
      503,
    );
}
export class MicrosoftProvider
  implements IdentityProvider, ApplicationProvider
{
  constructor(private w: Workspace) {}
  async token(feature: Feature) {
    const integration = this.w.integrations.find(
      (i) => i.provider === "Microsoft 365",
    );
    if (integration?.status !== "connected" || !integration.tenantId)
      throw new DomainError(
        "Connect Microsoft 365 before running this workflow.",
      );
    if (!integration.features.includes(feature))
      throw new DomainError(
        `Approve the ${microsoftFeatures[feature].name} feature in Integrations first.`,
      );
    const { data, error } = await db()
      .from("neutronium_credentials")
      .select("ciphertext,key_version")
      .eq("organization_id", this.w.id)
      .eq("provider", "microsoft")
      .maybeSingle();
    if (error) throw new DomainError("Credential store unavailable.", 503);
    if (data) {
      const stored = decrypt(data.ciphertext, data.key_version, this.w.id);
      if (stored.expiresAt > Date.now() + 60_000) return stored.token as string;
    }
    const token = await microsoftToken(integration.tenantId);
    for (const scope of microsoftFeatures[feature].permissions)
      if (!token.roles.includes(scope))
        throw new DomainError(`Microsoft consent is missing ${scope}.`);
    await storeToken(this.w.id, token);
    return token.access_token;
  }
  async graph(
    path: string,
    feature: Feature,
    method = "GET",
    body?: unknown,
    allowed: number[] = [],
  ) {
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token(feature)}`,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (allowed.includes(response.status)) return { absent: true };
    if (!response.ok)
      throw new DomainError(
        `Microsoft ${method} operation failed (${response.status}). Check permissions, resource configuration, and connection health.`,
        response.status === 429 || response.status >= 500 ? 503 : 422,
      );
    return response.status === 204 ? {} : response.json();
  }
  async createIdentity(e: Employee, key: string): Promise<ProviderResult> {
    const existing = await this.graph(
      `/users/${encodeURIComponent(e.email)}?$select=id,employeeId`,
      "provisioning",
      "GET",
      undefined,
      [404],
    );
    if (!existing.absent) {
      if (existing.employeeId !== microsoftWorkflowMarker(key))
        throw new DomainError(
          "An existing Microsoft account uses this email. Import and explicitly match it before changing its access.",
        );
      return { status: "success", reference: existing.id };
    }
    const created = await this.graph("/users", "provisioning", "POST", {
      accountEnabled: true,
      displayName: fullName(e),
      givenName: e.firstName,
      surname: e.lastName,
      userPrincipalName: e.email,
      mailNickname: e.email.split("@")[0],
      employeeId: microsoftWorkflowMarker(key),
      passwordProfile: {
        forceChangePasswordNextSignIn: true,
        password: `N!${randomBytes(32).toString("base64url")}9a`,
      },
    });
    return {
      status: "success",
      reference: created.id,
      note: "Password is not retained. An administrator must arrange secure initial sign-in.",
    };
  }
  async disable(e: Employee): Promise<ProviderResult> {
    if (!e.providerId)
      throw new DomainError("Employee has no matched Microsoft identity.");
    await this.graph(
      `/users/${encodeURIComponent(e.providerId)}`,
      "offboarding",
      "PATCH",
      { accountEnabled: false },
    );
    return { status: "success" };
  }
  async revokeSessions(e: Employee): Promise<ProviderResult> {
    if (!e.providerId)
      throw new DomainError("Employee has no matched Microsoft identity.");
    await this.graph(
      `/users/${encodeURIComponent(e.providerId)}/revokeSignInSessions`,
      "offboarding",
      "POST",
      {},
    );
    return { status: "success" };
  }
  async grant(
    e: Employee,
    app: Application,
    level: string,
  ): Promise<ProviderResult> {
    if (!app.groupId || level !== "Standard")
      return {
        status: "manual_required",
        note: "Configure a standard security group or grant this permission in the provider and verify completion.",
      };
    if (!e.providerId)
      throw new DomainError("Employee has no matched Microsoft identity.");
    const member = await this.graph(
      `/groups/${app.groupId}/members/${encodeURIComponent(e.providerId)}`,
      "groups",
      "GET",
      undefined,
      [404],
    );
    if (!member.absent)
      return {
        status: "manual_required",
        note: "This account is already a member of the configured group. Verify the existing access manually; Neutronium will not take ownership of, or automatically revoke, an untracked membership.",
      };
    if (member.absent)
      await this.graph(
        `/groups/${app.groupId}/members/$ref`,
        "groups",
        "POST",
        {
          "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${e.providerId}`,
        },
      );
    return { status: "success", reference: app.groupId };
  }
  async revoke(
    e: Employee,
    app: Application,
    reference?: string,
  ): Promise<ProviderResult> {
    if (!reference || !e.providerId)
      return {
        status: "manual_required",
        note: "No tracked group membership. Remove this access in the provider and verify completion.",
      };
    await this.graph(
      `/groups/${encodeURIComponent(reference)}/members/${encodeURIComponent(e.providerId)}/$ref`,
      "groups",
      "DELETE",
      undefined,
      [404],
    );
    return { status: "success" };
  }
}
export class DevelopmentProvider
  implements IdentityProvider, ApplicationProvider
{
  async createIdentity(e: Employee) {
    return { status: "success" as const, reference: `dev-${e.id}` };
  }
  async disable() {
    return { status: "success" as const };
  }
  async revokeSessions() {
    return { status: "success" as const };
  }
  async grant(e: Employee, app: Application, level: string) {
    return {
      status: "success" as const,
      reference: `dev:${app.id}:${e.id}:${level}`,
    };
  }
  async revoke() {
    return { status: "success" as const };
  }
}
export async function executeStep(
  w: Workspace,
  job: Job,
  step: Step,
): Promise<ProviderResult> {
  const e = w.employees.find((e) => e.id === job.employeeId);
  if (!e) throw new DomainError("Employee not found.");
  if (job.kind === "grant" && e.status !== "active")
    throw new DomainError(
      "Access cannot be granted after employee offboarding has started.",
    );
  const identity: IdentityProvider = w.demo
    ? new DevelopmentProvider()
    : new MicrosoftProvider(w);
  if (step.operation === "identity") return identity.createIdentity(e, job.id);
  if (step.operation === "disable") return identity.disable(e);
  if (step.operation === "sessions") return identity.revokeSessions(e);
  if (step.operation === "invitation")
    return w.demo
      ? {
          status: "success",
          note: "Use the development persona selector to open this employee’s portal.",
        }
      : {
          status: "manual_required",
          note: "Invite this employee using People → Invite to portal, and arrange secure Microsoft first sign-in.",
        };
  if (["preserve", "review_access"].includes(step.operation))
    return w.demo
      ? {
          status: "skipped",
          note: "No external data or directory roles exist in the development adapter.",
        }
      : {
          status: "manual_required",
          note:
            step.operation === "preserve"
              ? "Confirm mailbox retention, ownership transfers, and device access in your providers. No data is deleted automatically."
              : "Review and remove unmanaged groups, directory roles, and application assignments in Microsoft Entra.",
        };
  if (step.operation === "terminate") return { status: "success" };
  if (step.operation === "license") {
    if (w.demo) return { status: "success" };
    if (!e.providerId) throw new DomainError("Missing identity.");
    await new MicrosoftProvider(w).graph(
      `/users/${e.providerId}/assignLicense`,
      "licenses",
      "POST",
      { addLicenses: [{ skuId: job.template!.licenseId }], removeLicenses: [] },
    );
    return {
      status: "success",
      note: "License assigned. Mailbox readiness depends on Microsoft and the chosen email architecture.",
    };
  }
  if (step.operation.startsWith("group:")) {
    if (w.demo) return { status: "success" };
    return new MicrosoftProvider(w).grant(
      e,
      {
        id: "group",
        name: "Group",
        initials: "G",
        color: "#333",
        mode: "microsoft",
        url: "",
        groupId: step.operation.slice(6),
      },
      "Standard",
    );
  }
  const app = w.applications.find((app) => app.id === step.applicationId);
  if (!app) throw new DomainError("Application not found.");
  if (app.mode === "manual" || app.mode === "coming_soon")
    return {
      status: "manual_required",
      note: `${app.name} has no automated provider. Complete this action in ${app.name}, then record evidence here.`,
    };
  if (app.mode === "development" && !w.demo)
    throw new DomainError(
      "Development providers cannot run in production organizations.",
    );
  const provider: ApplicationProvider =
    app.mode === "development"
      ? new DevelopmentProvider()
      : new MicrosoftProvider(w);
  if (step.operation.startsWith("revoke:")) {
    const grant = w.grants.find((g) => g.id === step.operation.slice(7));
    if (!grant) throw new DomainError("Access grant not found.");
    return provider.revoke(e, app, grant.providerRef);
  }
  const request = w.requests.find((r) => r.id === job.requestId);
  return provider.grant(e, app, request?.level || "Standard", step.id);
}
