import nodemailer from "nodemailer";
import { DomainError } from "./model";

type OutboundEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  idempotencyKey?: string;
};

function provider() {
  const configured =
    process.env.NEUTRONIUM_EMAIL_PROVIDER?.trim().toLowerCase();
  if (configured === "cloudflare_smtp" || configured === "resend")
    return configured;
  return process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD
    ? "cloudflare_smtp"
    : "resend";
}

function smtpPassword() {
  // Keep the credential name specific to this application. The generic
  // CLOUDFLARE_API_TOKEN is intentionally not read from the runtime.
  return process.env.NEUTRONIUM_EMAIL_SMTP_PASSWORD || "";
}

export function emailConfigured() {
  const from = process.env.NEUTRONIUM_EMAIL_FROM;
  if (
    !from ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.replace(/^.*<|>.*$/g, ""))
  )
    return false;
  return provider() === "cloudflare_smtp"
    ? !!smtpPassword()
    : !!process.env.NEUTRONIUM_EMAIL_API_KEY;
}

export async function sendEmail(message: OutboundEmail) {
  if (!emailConfigured())
    throw new DomainError("Email delivery is not configured.", 503);

  if (provider() === "cloudflare_smtp") {
    const transporter = nodemailer.createTransport({
      host: "smtp.mx.cloudflare.net",
      port: 465,
      secure: true,
      auth: { user: "api_token", pass: smtpPassword() },
      disableFileAccess: true,
      disableUrlAccess: true,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    });
    try {
      await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.idempotencyKey
          ? { headers: { "X-Neutronium-Notification": message.idempotencyKey } }
          : {}),
      });
    } catch {
      throw new DomainError(
        "Authentication email could not be sent. Please retry.",
        503,
      );
    } finally {
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
