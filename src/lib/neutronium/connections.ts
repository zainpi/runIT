import {
  Actor,
  DomainError,
  ExternalItem,
  admins,
  audit,
  now,
  requireRole,
  uid,
} from "./model";
import { db, mutate } from "./store";
import { encrypt, decrypt } from "./providers";
export function connectionRequest(
  provider: string,
  input: Record<string, unknown>,
) {
  const token = String(input.token || "");
  if (!token || token.length > 4000 || /[\r\n]/.test(token))
    throw new DomainError("Enter an API token.");
  let url: string;
  let authorization = `Bearer ${token}`;
  if (provider === "vercel")
    url =
      "https://api.vercel.com/v9/projects?limit=100" +
      (input.scope ? `&teamId=${encodeURIComponent(String(input.scope))}` : "");
  else if (provider === "github") {
    if (!/^[\w.-]+\/[\w.-]+$/.test(String(input.scope)))
      throw new DomainError("Enter owner/repository.");
    url = `https://api.github.com/repos/${input.scope}/issues?state=open&per_page=100`;
  } else if (provider === "jira") {
    if (!/^[a-z0-9][a-z0-9-]*\.atlassian\.net$/.test(String(input.scope)))
      throw new DomainError("Enter your company.atlassian.net hostname.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email)))
      throw new DomainError("Enter the Atlassian account email.");
    url = `https://${input.scope}/rest/api/3/search/jql?jql=${encodeURIComponent("statusCategory != Done ORDER BY updated DESC")}&maxResults=100&fields=summary,status`;
    authorization = `Basic ${Buffer.from(`${input.email}:${token}`).toString("base64")}`;
  } else throw new DomainError("Unsupported integration.");
  return { url, authorization };
}
export async function syncConnection(
  a: Actor,
  provider: string,
  input?: Record<string, unknown>,
) {
  requireRole(a, admins);
  if (a.demo)
    throw new DomainError("Connect providers from a production workspace.");
  let credentials = input;
  if (!credentials) {
    const { data, error } = await db()
      .from("neutronium_credentials")
      .select("ciphertext,key_version")
      .eq("organization_id", a.orgId)
      .eq("provider", provider)
      .maybeSingle();
    if (error || !data) throw new DomainError("Connect this provider first.");
    credentials = decrypt(data.ciphertext, data.key_version, a.orgId);
  }
  const { url, authorization } = connectionRequest(provider, credentials!);
  const response = await fetch(url, {
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "User-Agent": "Neutronium",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new DomainError(
      `Provider returned ${response.status}. Check the token, scope, and account permissions.`,
      502,
    );
  const data = await response.json();
  const list =
    provider === "vercel"
      ? data.projects
      : provider === "jira"
        ? data.issues
        : data;
  if (!Array.isArray(list))
    throw new DomainError("Unexpected provider response.", 502);
  const items: ExternalItem[] = list
    .filter((x) => !x.pull_request)
    .slice(0, 100)
    .map((x) => ({
      id: String(x.id),
      title: String(x.name || x.fields?.summary || x.title || x.id),
      status: String(x.fields?.status?.name || x.state || "Project"),
      url:
        provider === "jira"
          ? `https://${credentials!.scope}/browse/${encodeURIComponent(x.key)}`
          : provider === "github"
            ? `https://github.com/${credentials!.scope}/issues/${Number(x.number)}`
            : `https://vercel.com/dashboard`,
    }));
  if (input) {
    const { error } = await db()
      .from("neutronium_credentials")
      .upsert({
        organization_id: a.orgId,
        provider,
        ...encrypt(input, a.orgId),
      });
    if (error)
      throw new DomainError("Could not save provider credentials.", 503);
  }
  await mutate(a.orgId, false, (w) => {
    (w.externalItems ||= {})[provider] = items;
    const integration = w.integrations.find((i) => i.provider === provider);
    const next = {
      id: integration?.id || uid(),
      provider,
      status: "connected" as const,
      features: ["read-only inventory"],
      checkedAt: now(),
    };
    if (integration) Object.assign(integration, next);
    else w.integrations.push(next);
    audit(w, a, "Integration synchronized", provider, uid(), undefined, {
      count: items.length,
      limit: 100,
    });
  });
  return items.length;
}
