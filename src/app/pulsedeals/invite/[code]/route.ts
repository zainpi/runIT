import { normalizeReferralCode } from "@/lib/pulsedeals/referrals";
import { getPulseDealsEnv } from "@/lib/pulsedeals/compatibility";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const code = normalizeReferralCode((await context.params).code);
  if (!code) return new Response("This invitation is invalid.", { status: 404 });
  const appID = getPulseDealsEnv("PULSEDEALS_APPLE_ID");
  const install = appID && /^\d+$/.test(appID)
    ? `<a class="secondary" href="https://apps.apple.com/app/id${appID}">Get PulseDeals</a>` : "";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>You’re invited to PulseDeals</title><meta name="description" content="Find your next great deal with a friend. Add their referral code before your first trial.">
<style>html{color-scheme:light dark}body{font:17px/1.6 system-ui,sans-serif;margin:0;background:light-dark(#fff8f4,#1e1714);color:light-dark(#291e19,#fff6f0)}main{max-width:32rem;margin:6vh auto;padding:2rem}h1{font-size:clamp(2rem,8vw,3rem);line-height:1.1;letter-spacing:-.04em}h2{font-size:1rem}p{opacity:.85}code{display:block;font-size:1.6rem;letter-spacing:.08em;user-select:all;padding:1rem 0}a{color:inherit}a.button,a.secondary{display:block;text-align:center;padding:.85rem;border-radius:1rem;font-weight:650;margin:.8rem 0;text-decoration:none}a.button{background:#b7370c;color:white}a.secondary{border:1px solid currentColor}footer{margin-top:2rem;font-size:.85rem}small{display:block}</style></head><body><main>
<p>PulseDeals · You’re invited</p><h1>Good deals are better with friends.</h1>
<p>New to PulseDeals? Add your friend’s code before starting your first subscription trial. When Apple verifies your trial, your friend earns one free week.</p>
<h2>Your friend’s referral code</h2><code>${code}</code>
<a class="button" href="pulsedeals://referral/${code}">Open invite in PulseDeals</a>${install}
<p>Installing for the first time? Keep this code, then enter it during signup or before starting your trial. You can also return here after installing and open the invite.</p>
<small>Trial eligibility and pricing are shown in the app and confirmed by Apple. This invitation does not start a subscription. One referral per new user.</small>
<footer><a href="/pulsedeals/terms">Terms</a> · <a href="/pulsedeals/privacy">Privacy</a> · <a href="/pulsedeals/support">Support</a></footer>
</main></body></html>`, { headers: {
    "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
  } });
}
