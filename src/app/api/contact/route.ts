import { NextResponse } from "next/server";

/**
 * Lead intake endpoint.
 *
 * This validates the payload and returns success. To go live, plug your
 * provider in where indicated below — e.g. send an email (Resend/SendGrid),
 * create a CRM record (HubSpot/Pipedrive), or post to a webhook (n8n/Zapier).
 */

type ContactPayload = {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  challenge?: string;
  revenue?: string;
  // Optional booking-questionnaire fields
  teamSize?: string;
  timeline?: string;
  source?: string;
  // Honeypot — should be empty for real humans.
  company_website?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let data: ContactPayload;
  try {
    data = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  // Honeypot: silently accept bots without doing anything.
  if (data.company_website) {
    return NextResponse.json({ ok: true });
  }

  const errors: Record<string, string> = {};
  if (!data.name?.trim()) errors.name = "Name is required.";
  if (!data.email?.trim() || !EMAIL_RE.test(data.email)) {
    errors.email = "A valid email is required.";
  }
  if (!data.challenge?.trim()) {
    errors.challenge = "Please tell us a bit about your challenge.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // --- Integration point -------------------------------------------------
  // await sendEmail({ to: site.email, ...data });
  // await createCrmLead(data);
  // await fetch(process.env.LEAD_WEBHOOK_URL!, { method: "POST", body: ... });
  // For now we just log on the server.
  if (process.env.NODE_ENV !== "production") {
    console.info("New lead submission:", data);
  }
  // -----------------------------------------------------------------------

  return NextResponse.json({ ok: true });
}
