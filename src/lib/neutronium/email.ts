import nodemailer from "nodemailer";
import { DomainError } from "./model";

type OutboundEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  idempotencyKey?: string;
};

type EmailProvider = "cloudflare_rest" | "cloudflare_smtp" | "resend";

function provider() {
  const configured =
    process.env.NEUTRONIUM_EMAIL_PROVIDER?.trim().toLowerCase();
  if (
    configured === "cloudflare_rest" ||
    configured === "cloudflare_smtp" ||
    configured === "resend"
  )
    return configured;
  if (cloudflareToken() && cloudflareAccountId()) return "cloudflare_rest";
  if (cloudflareToken()) return "cloudflare_smtp";
  return "resend";
}

function cloudflareToken() {
  // Keep the credential name specific to this application. The generic
  // CLOUDFLARE_API_TOKEN is intentionally not read from the runtime.
  return (
    process.env.NEUTRONIUM_EMAIL_CLOUDFLARE_TOKEN?.trim() ||
    process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD?.trim() ||
    ""
  );
}

function cloudflareAccountId() {
  const value = process.env.NEUTRONIUM_CLOUDFLARE_ACCOUNT_ID?.trim() || "";
  return /^[a-f0-9]{32}$/i.test(value) ? value : "";
}

export function emailConfigured() {
  const from = process.env.NEUTRONIUM_EMAIL_FROM;
  if (
    !from ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.replace(/^.*<|>.*$/g, ""))
  )
    return false;
  const selected = provider() as EmailProvider;
  if (selected === "cloudflare_rest")
    return !!cloudflareToken() && !!cloudflareAccountId();
  if (selected === "cloudflare_smtp") return !!cloudflareToken();
  return !!process.env.NEUTRONIUM_EMAIL_API_KEY;
}

export async function sendEmail(message: OutboundEmail) {
  if (!emailConfigured())
    throw new DomainError("Email delivery is not configured.", 503);

  if (provider() === "cloudflare_rest") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId()}/email/sending/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cloudflareToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: message.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            ...(message.idempotencyKey
              ? {
                  headers: {
                    "X-Neutronium-Notification": message.idempotencyKey,
                  },
                }
              : {}),
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        console.error("Neutronium email rejected", {
          provider: "cloudflare_rest",
          status: response.status,
        });
        throw new Error("Email provider rejected the request.");
      }
      const body = await response.json();
      if (body.success !== true || !body.result?.message_id)
        throw new Error("Email provider did not acknowledge the message.");
      if (
        body.result.permanent_bounces?.length ||
        body.result.suppressed_recipients?.length
      ) {
        console.error("Neutronium email recipient rejected", {
          provider: "cloudflare_rest",
          bounced: body.result.permanent_bounces?.length || 0,
          suppressed: body.result.suppressed_recipients?.length || 0,
        });
        throw new DomainError(
          "Email delivery was rejected for this address. Check the address and your mail service’s blocked senders, then retry.",
          503,
        );
      }
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        "Authentication email could not be sent. Please retry.",
        503,
      );
    } finally {
      clearTimeout(timer);
    }
    return;
  }

  if (provider() === "cloudflare_smtp") {
    const transporter = nodemailer.createTransport({
      host: "smtp.mx.cloudflare.net",
      port: 465,
      secure: true,
      auth: { user: "api_token", pass: cloudflareToken() },
      disableFileAccess: true,
      disableUrlAccess: true,
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 5_000,
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        transporter.sendMail({
          from: message.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.idempotencyKey
            ? {
                headers: {
                  "X-Neutronium-Notification": message.idempotencyKey,
                },
              }
            : {}),
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("SMTP connection timed out.")),
            10_000,
          );
        }),
      ]);
      if (result.rejected?.length || !result.accepted?.length)
        throw new Error("SMTP rejected the recipient.");
    } catch {
      throw new DomainError(
        "Authentication email could not be sent. Please retry.",
        503,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
      transporter.close();
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NEUTRONIUM_EMAIL_API_KEY}`,
      "Content-Type": "application/json",
      ...(message.idempotencyKey
        ? { "Idempotency-Key": message.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new DomainError(
      "Authentication email could not be sent. Please retry.",
      503,
    );
}
