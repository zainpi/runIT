import { NextResponse } from "next/server";

/**
 * TestFlight invite endpoint.
 *
 * A visitor submits their email on /the-last-echo, and this sends that
 * address a TestFlight beta invite via Cloudflare's email/sending/send API.
 *
 * Environment (set in the Cloudflare Worker: Settings > Variables and secrets):
 *   EMAIL_API_TOKEN  (Secret)   the Cloudflare email-sending API token (Bearer)
 *   TESTFLIGHT_URL   (Variable) https://testflight.apple.com/join/XXXXXXXX
 *
 * Optional overrides (safe defaults baked in):
 *   TESTFLIGHT_ACCOUNT_ID  defaults to 5abaf153560ef76bea3f9c95fbb18481
 *   TESTFLIGHT_FROM_EMAIL  defaults to welcome@runs-it.com
 */

const DEFAULT_ACCOUNT_ID = "5abaf153560ef76bea3f9c95fbb18481";
const DEFAULT_FROM_EMAIL = "welcome@runs-it.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  // Accept either JSON or form-encoded (the landing page posts FormData).
  let email = "";
  let honeypot = "";
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      email = String(body.email ?? "").trim().toLowerCase();
      honeypot = String(body.website ?? body.hp ?? "").trim();
    } else {
      const form = await request.formData();
      email = String(form.get("email") ?? "").trim().toLowerCase();
      honeypot = String(form.get("website") ?? form.get("hp") ?? "").trim();
    }
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Honeypot: silently accept bots without sending anything.
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 422 });
  }

  const token = process.env.EMAIL_API_TOKEN;
  const testflightUrl = process.env.TESTFLIGHT_URL;
  if (!token || !testflightUrl) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  const accountId = process.env.TESTFLIGHT_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const from = process.env.TESTFLIGHT_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  const payload = {
    to: email,
    from,
    subject: "Your Last Echo beta invite is here",
    html: buildHtml(testflightUrl),
    text: buildText(testflightUrl),
  };

  let resp: Response;
  try {
    resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  if (!resp.ok) {
    // Log status only; never log the recipient or the token.
    console.log("testflight_email_failed", resp.status);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

/* ---------------------------------------------------------------- *
 *  Email content (image-free by design: nothing to break on open)
 * ---------------------------------------------------------------- */

function buildText(url: string): string {
  return [
    "You're invited to test The Last Echo : Idle RPG",
    "",
    "Thanks for signing up! Your invite to the iOS beta is ready.",
    "",
    "Join the beta on TestFlight:",
    url,
    "",
    "How it works:",
    "1. Install TestFlight from the App Store (free).",
    "2. Open the link above on your iPhone.",
    "3. Install the game and start playing.",
    "",
    "iOS only for now. Android is coming later.",
    "",
    "Found a bug or have a thought? Just reply to this email and we read every one.",
    "",
    "Zain and the team",
    "",
    "You're getting this because you signed up at runs-it.com.",
    "Didn't sign up? You can safely ignore this; nothing happens without the tap.",
  ].join("\n");
}

function buildHtml(url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>You're invited to test The Last Echo</title>
</head>
<body style="margin:0; padding:0; background-color:#2a1a0d; font-family:'Segoe UI', Helvetica, Arial, sans-serif;">

  <!-- Preheader (hidden inbox preview text) -->
  <div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
    Tap to join on TestFlight. Takes about a minute. Thanks for being early.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#2a1a0d; padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background-color:#F3E7C9; border-radius:16px; overflow:hidden; border:3px solid #6B4423; box-shadow:0 8px 32px rgba(0,0,0,0.4);">

          <!-- Gilded top edge -->
          <tr><td style="height:4px; background-color:#C9A86A; line-height:4px; font-size:4px;">&nbsp;</td></tr>

          <!-- Header wordmark band -->
          <tr>
            <td style="background-color:#3F2812; padding:28px 32px 30px 32px; text-align:center;">
              <img src="https://runs-it.com/the-last-echo/img/apple-touch-icon.png" width="76" height="76" alt="The Last Echo" style="display:block; margin:0 auto 16px auto; border-radius:18px; border:2px solid #C9A86A;">
              <div style="font-size:12px; letter-spacing:3px; color:#C9A86A; text-transform:uppercase;">&#10022;&nbsp;&nbsp;Early Access Invite&nbsp;&nbsp;&#10022;</div>
              <div style="font-size:32px; font-weight:800; color:#F3E7C9; margin-top:10px; line-height:1.15;">The Last Echo</div>
              <div style="font-size:14px; color:#C9A86A; margin-top:4px; letter-spacing:2px;">IDLE RPG</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 8px 36px; color:#3F2812;">
              <p style="font-size:17px; line-height:1.6; margin:0 0 16px 0;">Hey there,</p>
              <p style="font-size:17px; line-height:1.6; margin:0 0 16px 0;">
                Thanks for signing up! <strong>The Last Echo</strong> is a cozy fantasy idle RPG where your heroes keep battling and leveling up even while you're away. Your invite to the iOS beta is ready. Tap below and TestFlight handles the rest.
              </p>
            </td>
          </tr>

          <!-- Gameplay hero -->
          <tr>
            <td style="padding:6px 36px 4px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #6B4423; border-radius:12px; overflow:hidden;">
                <tr><td style="font-size:0; line-height:0;">
                  <img src="https://runs-it.com/the-last-echo/screenshots/battle.png" alt="The Last Echo battle gameplay" width="524" style="display:block; width:100%; max-width:524px; height:auto; border:0;">
                </td></tr>
              </table>
              <div style="font-size:12px; color:#8A5A2B; text-align:center; margin-top:8px;">Auto-battle through a hand-crafted world of original creatures.</div>
            </td>
          </tr>

          <!-- CTA button (bulletproof, gold + wood outline) -->
          <tr>
            <td align="center" style="padding:14px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" bgcolor="#C9A86A" style="border-radius:12px; border:2px solid #3F2812;">
                  <a href="${url}" style="display:inline-block; padding:16px 48px; font-size:18px; font-weight:800; color:#3F2812; text-decoration:none; letter-spacing:0.5px;">Join the Beta</a>
                </td>
              </tr></table>
              <div style="font-size:13px; color:#6B4423; margin-top:14px; line-height:1.5;">
                or paste this link on your iPhone:<br>
                <a href="${url}" style="color:#8A5A2B; word-break:break-all;">${url}</a>
              </div>
              <div style="font-size:12px; color:#8A5A2B; margin-top:10px;">iOS only for now. Android is coming later.</div>
            </td>
          </tr>

          <!-- How-to strip -->
          <tr>
            <td style="padding:20px 36px 8px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E8D3A8; border-radius:12px; border:1px solid #C9A86A;">
                <tr>
                  <td style="padding:18px 22px;">
                    <div style="font-size:13px; letter-spacing:1px; text-transform:uppercase; color:#6B4423; font-weight:700; margin-bottom:12px;">Getting started</div>
                    ${step("1", "Install <strong>TestFlight</strong> from the App Store (it's free).")}
                    ${step("2", "Open the invite link above on your iPhone.")}
                    ${step("3", "Install the game and dive in!")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feedback note -->
          <tr>
            <td style="padding:18px 36px 28px 36px; color:#3F2812;">
              <p style="font-size:16px; line-height:1.6; margin:0;">
                Found a bug, a confusing bit, or something you love? Just <strong>reply to this email</strong>. We read every one, and it genuinely shapes what ships. &#128153;
              </p>
              <p style="font-size:16px; line-height:1.6; margin:14px 0 0 0;">Zain &amp; the team</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#3F2812; padding:20px 32px; text-align:center;">
              <div style="font-size:12px; color:#C9A86A; line-height:1.7;">
                The Last Echo : Idle RPG &middot; iOS Beta<br>
                You're getting this because you signed up at <a href="https://runs-it.com" style="color:#E8D3A8;">runs-it.com</a>.<br>
                Didn't sign up? You can ignore this; nothing happens without the tap.<br>
                <a href="https://runs-it.com/the-last-echo/privacy.html" style="color:#C9A86A;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="https://runs-it.com/the-last-echo/terms.html" style="color:#C9A86A;">Terms</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function step(n: string, html: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr>
    <td width="28" valign="top">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="26" height="26" align="center" valign="middle" bgcolor="#3F2812" style="border-radius:13px; color:#C9A86A; font-size:14px; font-weight:800;">${n}</td>
      </tr></table>
    </td>
    <td style="padding-left:12px; color:#3F2812; font-size:15px; line-height:1.5;" valign="middle">${html}</td>
  </tr></table>`;
}
