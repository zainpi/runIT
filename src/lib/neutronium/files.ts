import {
  createHmac,
  timingSafeEqual,
  randomUUID,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, writeFile, readFile, link, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Actor, DomainError, Workspace } from "./model";
import { visibleRequest } from "./operations";
function root() {
  return resolve(
    process.env.NEUTRONIUM_PRIVATE_FILES_DIR || ".neutronium-dev/private-files",
  );
}
function path(orgId: string, key: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orgId,
    ) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
  )
    throw new DomainError("File not found.", 404);
  return join(root(), orgId, key);
}
export async function writeAttachment(
  orgId: string,
  data: string,
  key: string = randomUUID(),
) {
  const bytes = Buffer.from(data, "base64");
  if (!data || bytes.length > 50000 || bytes.toString("base64") !== data)
    throw new DomainError("Files must be valid base64 and at most 50 KB.");
  const target = path(orgId, key);
  await mkdir(join(root(), orgId), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
    try {
      await link(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(target);
      if (!existing.equals(bytes))
        throw new DomainError(
          "Existing attachment does not match the backfill. Preserve both copies and investigate.",
          409,
        );
    }
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return key;
}
export async function externalizeAttachments(w: Workspace) {
  for (const r of w.helpRequests || [])
    for (const m of r.messages) {
      if (m.attachment?.data) {
        const key = await writeAttachment(w.id, m.attachment.data, m.id);
        m.attachment = { name: m.attachment.name, key };
      }
    }
}
const developmentSigningKey = randomBytes(32).toString("hex");
function secret() {
  const key =
    process.env.NEUTRONIUM_FILE_SIGNING_KEY ||
    process.env.NEUTRONIUM_CRON_SECRET ||
    (process.env.NODE_ENV === "development"
      ? developmentSigningKey
      : undefined);
  if (!key || key.length < 32)
    throw new DomainError("Configure a private download signing key.", 503);
  return key;
}
export const sessionBinding = (session: string) =>
  createHash("sha256").update(session).digest("hex");
export function fileTicket(
  a: Actor,
  requestId: string,
  messageId: string,
  binding: string,
  expires = Date.now() + 60000,
) {
  const payload = Buffer.from(
    JSON.stringify({
      org: a.orgId,
      user: a.id,
      requestId,
      messageId,
      binding,
      expires,
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyFileTicket(ticket: string, a: Actor, binding: string) {
  const [p, s] = ticket.split(".");
  const expected = createHmac("sha256", secret())
    .update(p || "")
    .digest();
  const actual = Buffer.from(s || "", "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual))
    throw new DomainError("Download link is invalid.", 403);
  let data;
  try {
    data = JSON.parse(Buffer.from(p, "base64url").toString());
  } catch {
    throw new DomainError("Download link is invalid.", 403);
  }
  if (
    data.org !== a.orgId ||
    data.user !== a.id ||
    data.binding !== binding ||
    data.expires < Date.now()
  )
    throw new DomainError(
      "Download link expired or belongs to another session.",
      403,
    );
  return data as { requestId: string; messageId: string };
}
export async function attachmentFor(
  w: Workspace,
  a: Actor,
  requestId: string,
  messageId: string,
) {
  if (w.id !== a.orgId) throw new DomainError("File not found.", 404);
  const r = w.helpRequests?.find(
    (r) => r.id === requestId && visibleRequest(r, a),
  );
  const m = r?.messages.find(
    (m) =>
      m.id === messageId &&
      (!m.internal || ["ORG_OWNER", "ORG_ADMIN"].includes(a.role)),
  );
  if (!m?.attachment) throw new DomainError("File not found.", 404);
  return {
    name: m.attachment.name,
    bytes: m.attachment.key
      ? await readFile(path(w.id, m.attachment.key))
      : Buffer.from(m.attachment.data || "", "base64"),
  };
}
