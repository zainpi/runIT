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
HEATERDEALS_BUNDLE_ID=com.pulsedeals.app
HEATERDEALS_PRODUCT_ID=com.pulsedeals.subscription.monthly

# Discord community access
HEATERDEALS_DISCORD_CLIENT_ID=<Discord application client ID>
HEATERDEALS_DISCORD_CLIENT_SECRET=<Discord application client secret>
HEATERDEALS_DISCORD_BOT_TOKEN=<Discord bot token>
HEATERDEALS_DISCORD_GUILD_ID=<private Pulse Deals server ID>
HEATERDEALS_DISCORD_ROLE_ID=<subscriber-only access-role ID>
HEATERDEALS_DISCORD_REDIRECT_URI=https://runsit.ca/heaterdeals/api/v1/discord/callback
HEATERDEALS_DISCORD_APP_CALLBACK=pulsedeals://discord/callback
HEATERDEALS_DISCORD_SERVER_NAME=Pulse Deals
```

`APPLE_ROOT_CA_G3_BASE64` is optional. If it is absent, the Apple transaction verifier fetches
Apple's published root certificates at runtime and caches them. The Keepa key is only used by the
scheduled server sync; it is never sent to the app.

## Database

The original additive migration
`supabase/migrations/20260807160000_heaterdeals_backend.sql` has been applied to the linked
Supabase project and creates the account, entitlement, deal, alert, rate-limit, idempotency, and
Keepa-lock tables/functions. Supabase's pre-existing migration history is preserved. Apply the
Discord-specific migration
`supabase/migrations/20260904000000_heaterdeals_discord.sql` before enabling the Discord routes.

## Apple configuration

Set the App Store Server Notifications V2 URL to:

```text
https://runsit.ca/heaterdeals/api/v1/webhooks/apple
```

Use the Production URL for the live app. Apple sandbox notifications use the same endpoint; the
signed payload identifies the environment. Test Sign in with Apple, the introductory offer,
restore, renewal/expiration, and account deletion in TestFlight before submission.

## Discord community access

Discord linking is optional in the app, but the following production setup is required before
enabling it:

1. Create or use a Discord Developer Portal application and add the exact OAuth2 redirect URI
   `https://runsit.ca/heaterdeals/api/v1/discord/callback`.
2. Enable the `identify` and `guilds.join` scopes for the application. Add the application’s bot
   to the target guild. Discord requires the bot to have **Create Instant Invite** in that guild
   for the add-member endpoint.
3. Set the five required Discord values above. `HEATERDEALS_DISCORD_ROLE_ID` must be the private
   subscriber role; the bot’s highest role must be above it and have **Manage Roles**. A role is
   required so subscription expiration and disconnect can revoke access without deleting a
   member’s Discord account.
4. Apply the additive migration
   `supabase/migrations/20260904000000_heaterdeals_discord.sql`.
5. Test both paths: a subscriber who is not in the guild is added and receives the role; an
   existing guild member can link the same Discord account and have access reconciled. Complete
   Discord membership screening if the guild requires it.

The app starts the OAuth authorization-code flow from **You → Pulse Deals on Discord**. The
server validates a short-lived, one-time state, adds or reconciles the guild member, grants or
removes the access role as the Apple entitlement changes, and redirects back to the app through
`pulsedeals://discord/callback`. Discord OAuth access tokens are used transiently and revoked
after linking; they are not stored. Disconnecting removes the Pulse Deals access role but does not
delete the user’s Discord account or forcibly remove them from the guild.

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
