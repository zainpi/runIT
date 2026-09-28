import { site } from "./site";

export const contactTopics = {
  product: "A question about a product",
  template: "Help with an AI template order",
  custom: "A custom template idea",
  other: "Something else",
} as const;
export type ContactTopic = keyof typeof contactTopics;

export const contactLimits = { name: 100, email: 200, message: 5000 } as const;
export type ContactInput = { name: string; email: string; topic: ContactTopic; message: string };
export type ContactField = keyof ContactInput;
export type ContactValidation =
  | { ok: true; value: ContactInput }
  | { ok: false; spam: true }
  | { ok: false; spam?: false; errors: Partial<Record<ContactField, string>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Shared by the form and the API so both report the same messages.
export function validateContact(body: unknown): ContactValidation {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  // Hidden field that people never see; automated submissions tend to fill it.
  if (text(data.website)) return { ok: false, spam: true };
  const name = text(data.name);
  const email = text(data.email);
  const message = text(data.message);
  const topic = text(data.topic) as ContactTopic;
  const errors: Partial<Record<ContactField, string>> = {};
  if (!name) errors.name = "Enter your name.";
  else if (name.length > contactLimits.name) errors.name = `Use ${contactLimits.name} characters or fewer.`;
  if (!email) errors.email = "Enter your email address so we can reply.";
  else if (email.length > contactLimits.email || !EMAIL.test(email)) errors.email = "Enter an email address like you@example.com.";
  if (!(topic in contactTopics)) errors.topic = "Choose what your message is about.";
  if (message.length < 10) errors.message = "Tell us a little more (at least 10 characters).";
  else if (message.length > contactLimits.message) errors.message = `Keep your message under ${contactLimits.message.toLocaleString("en-CA")} characters.`;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, email, topic, message } };
}

export type ContactEnvironment = Record<string, unknown>;
export type DeliveryResult = { delivered: true } | { delivered: false; reason: "not-configured" | "failed" };

const setting = (env: ContactEnvironment, key: string) => (typeof env[key] === "string" ? (env[key] as string).trim() : "");

export function contactDeliveryConfigured(env: ContactEnvironment) {
  return Boolean(setting(env, "CONTACT_RESEND_API_KEY") && setting(env, "CONTACT_FROM_EMAIL"));
}

// Sends the message through Resend's email API. Nothing is stored by runsIT.
export async function deliverContact(input: ContactInput, env: ContactEnvironment, send: typeof fetch = fetch): Promise<DeliveryResult> {
  if (!contactDeliveryConfigured(env)) return { delivered: false, reason: "not-configured" };
  const to = setting(env, "CONTACT_TO_EMAIL") || site.email;
  const body = [
    `Topic: ${contactTopics[input.topic]}`,
    `From: ${input.name} <${input.email}>`,
    "",
    input.message,
  ].join("\n");
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${setting(env, "CONTACT_RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: setting(env, "CONTACT_FROM_EMAIL"),
        to: [to],
        reply_to: input.email,
        subject: `runsIT contact: ${contactTopics[input.topic]} (${input.name.slice(0, 60)})`,
        text: body,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? { delivered: true } : { delivered: false, reason: "failed" };
  } catch {
    return { delivered: false, reason: "failed" };
  }
}
