import { NextResponse } from "next/server";
import { deliverContact, validateContact } from "@/lib/contact";
import { site } from "@/lib/site";

const MAX_BODY_BYTES = 20_000;
const allowedOrigins = new Set(["https://runsit.ca", "https://www.runsit.ca", "https://runs-it.com", "https://www.runs-it.com"]);

async function environment(): Promise<Record<string, unknown>> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return { ...process.env, ...getCloudflareContext().env };
  } catch {
    return process.env;
  }
}

// Returns the verified origin of a same-site request, or null. Compares with the Host header
// because request.url can report an internal host behind proxies.
function sameSiteOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return allowedOrigins.has(url.origin) || url.host === request.headers.get("host") ? url.origin : null;
  } catch {
    return null;
  }
}

const unavailable = `The contact form isn’t available right now. Please email us at ${site.email}.`;
const failed = `We couldn’t send your message. Please try again, or email us at ${site.email}.`;

/**
 * Contact form endpoint. Accepts JSON from the enhanced form, or a regular form post
 * when JavaScript is unavailable (answered with a redirect).
 */
export async function POST(request: Request) {
  const formPost = (request.headers.get("content-type") ?? "").startsWith("application/x-www-form-urlencoded");
  const origin = sameSiteOrigin(request);
  const redirect = (path: string) => NextResponse.redirect(new URL(path, origin ?? request.url), 303);
  const reply = (status: number, body: Record<string, unknown>, formError: string) =>
    formPost ? redirect(`/contact/?error=${formError}#contact-form`) : NextResponse.json(body, { status });

  if (!origin) return reply(403, { ok: false, error: "This request couldn’t be verified. Reload the page and try again." }, "failed");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: "Your message is too long." }, "invalid");
  let body: unknown;
  try {
    body = formPost ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: "The form data couldn’t be read. Please try again." }, "invalid");
  }

  const result = validateContact(body);
  // Pretend success for hidden-field submissions so automated senders learn nothing.
  if (!result.ok && result.spam) return formPost ? redirect("/contact/thanks/") : NextResponse.json({ ok: true });
  if (!result.ok) return reply(422, { ok: false, errors: result.errors }, "invalid");

  const delivery = await deliverContact(result.value, await environment());
  if (!delivery.delivered) {
    return delivery.reason === "not-configured"
      ? reply(503, { ok: false, error: unavailable }, "unavailable")
      : reply(502, { ok: false, error: failed }, "failed");
  }
  return formPost ? redirect("/contact/thanks/") : NextResponse.json({ ok: true });
}
