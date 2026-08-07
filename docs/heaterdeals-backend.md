# HeaterDeals backend deployment

The HeaterDeals API is deployed by the existing runsIT Cloudflare Worker. Both
`https://runsit.ca` and `https://runs-it.com` route to that Worker; the iOS client uses
`https://runsit.ca/heaterdeals/api/v1`.

## Required production secrets

Set these as encrypted secrets in the Cloudflare/GitHub deployment integration before the first
live subscription test. Never commit their values.

```text
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role key for tkkuncbgyslnaukzhlgr>
HEATERDEALS_SESSION_SECRET=<at least 32 random bytes, base64 or high-entropy text>
HEATERDEALS_CRON_SECRET=<at least 32 random bytes, base64 or high-entropy text>
KEEPA_API_KEY=<Keepa API key>
HEATERDEALS_APPLE_ID=<numeric App Store Connect app Apple ID>
HEATERDEALS_BUNDLE_ID=com.heaterdeals.app
HEATERDEALS_PRODUCT_ID=com.heaterdeals.subscription.monthly
```

`APPLE_ROOT_CA_G3_BASE64` is optional. If it is absent, the Apple transaction verifier fetches
Apple's published root certificates at runtime and caches them. The Keepa key is only used by the
scheduled server sync; it is never sent to the app.

## Database

The additive migration is
`supabase/migrations/20260807160000_heaterdeals_backend.sql`. It has been applied to the linked
Supabase project and creates the account, entitlement, deal, alert, rate-limit, idempotency, and
Keepa-lock tables/functions. Supabase's pre-existing migration history is preserved.

## Apple configuration

Set the App Store Server Notifications V2 URL to:

```text
https://runsit.ca/heaterdeals/api/v1/webhooks/apple
```

Use the Production URL for the live app. Apple sandbox notifications use the same endpoint; the
signed payload identifies the environment. Test Sign in with Apple, the introductory offer,
restore, renewal/expiration, and account deletion in TestFlight before submission.

## Sync and API controls

The Worker cron runs every five minutes and rotates through the US, Canada, Germany, and UK Keepa
marketplaces. The internal sync route requires `HEATERDEALS_CRON_SECRET`, uses a database lock, and
upserts normalized deals. Authenticated feed and deal requests require an active entitlement and
are rate limited by account and client IP. Billing, alerts, account auth, and refresh requests
have separate limits; alert writes also accept an idempotency key. The API never exposes the Keepa
credential.

The Keepa adapter follows the KeepaBot-master DealsBrowser data path: price type 1 (NEW), the
Deals API’s nested `current`/`avg`/`deltaPercent` values, 90/365-day product statistics, CSV price
history, and the same marketplace domain IDs. The mobile feed uses a deterministic heat score so
it does not depend on a second AI API at request time; if the existing bot’s AI scoring rules are
later made available as a shared service, the normalized `score`, `confidence`, and `reasoning`
fields are the integration point.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in development values. `.dev.vars` is ignored by
Git. `npm run build:next` checks the Next.js app; `npm run build:cloudflare` runs the full OpenNext
Worker bundle check.
