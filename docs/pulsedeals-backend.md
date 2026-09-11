# PulseDeals backend deployment

The PulseDeals API is deployed by the existing runsIT Cloudflare Worker. Both
`https://runsit.ca` and `https://runs-it.com` route to that Worker; the iOS client uses
`https://runsit.ca/pulsedeals/api/v1`.

For the coordinated database, API, and configuration rename, follow
[the PulseDeals rename rollout](pulsedeals-rename-rollout.md) before releasing this build.
The new code requires `20260910020000_pulsedeals_rename.sql` after all earlier service migrations.

## Required production secrets

Set these as encrypted secrets in the Cloudflare/GitHub deployment integration before the first
live subscription test. Never commit their values.

```text
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role key for tkkuncbgyslnaukzhlgr>
PULSEDEALS_SESSION_SECRET=<at least 32 random bytes, base64 or high-entropy text>
PULSEDEALS_CRON_SECRET=<at least 32 random bytes, base64 or high-entropy text>
KEEPA_API_KEY=<Keepa API key>
PULSEDEALS_APPLE_ID=<numeric App Store Connect app Apple ID>
PULSEDEALS_BUNDLE_ID=com.pulsedeals.app
PULSEDEALS_PRODUCT_ID=com.pulsedeals.subscription.weekly

# Discord community access
PULSEDEALS_DISCORD_CLIENT_ID=<Discord application client ID>
PULSEDEALS_DISCORD_CLIENT_SECRET=<Discord application client secret>
PULSEDEALS_DISCORD_BOT_TOKEN=<Discord bot token>
PULSEDEALS_DISCORD_GUILD_ID=<private PulseDeals server ID>
PULSEDEALS_DISCORD_ROLE_ID=<subscriber-only access-role ID>
PULSEDEALS_DISCORD_REDIRECT_URI=https://runsit.ca/pulsedeals/api/v1/discord/callback
PULSEDEALS_DISCORD_APP_CALLBACK=pulsedeals://discord/callback
PULSEDEALS_DISCORD_SERVER_NAME=PulseDeals
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
https://runsit.ca/pulsedeals/api/v1/webhooks/apple
```

Use the Production URL for the live app. Apple sandbox notifications use the same endpoint; the
signed payload identifies the environment. Test Sign in with Apple, the introductory offer,
restore, renewal/expiration, and account deletion in TestFlight before submission.

## Discord community access

Discord linking is optional in the app, but the following production setup is required before
enabling it:

1. Create or use a Discord Developer Portal application and add the exact OAuth2 redirect URI
   `https://runsit.ca/pulsedeals/api/v1/discord/callback`.
2. Enable the `identify` and `guilds.join` scopes for the application. Add the application’s bot
   to the target guild. Discord requires the bot to have **Create Instant Invite** in that guild
   for the add-member endpoint.
3. Set the five required Discord values above. `PULSEDEALS_DISCORD_ROLE_ID` must be the private
   subscriber role; the bot’s highest role must be above it and have **Manage Roles**. A role is
   required so subscription expiration and disconnect can revoke access without deleting a
   member’s Discord account.
4. Apply the additive migration
   `supabase/migrations/20260904000000_heaterdeals_discord.sql`.
5. Test both paths: a subscriber who is not in the guild is added and receives the role; an
   existing guild member can link the same Discord account and have access reconciled. Complete
   Discord membership screening if the guild requires it.

The app starts the OAuth authorization-code flow from **You → PulseDeals on Discord**. The
server validates a short-lived, one-time state, adds or reconciles the guild member, grants or
removes the access role as the Apple entitlement changes, and redirects back to the app through
`pulsedeals://discord/callback`. Discord OAuth access tokens are used transiently and revoked
after linking; they are not stored. Disconnecting removes the PulseDeals access role but does not
delete the user’s Discord account or forcibly remove them from the guild.

## Sync and API controls

The Worker cron runs every five minutes and rotates through the Germany, UK, Spain, France, and Italy Keepa
marketplaces. The internal sync route requires `PULSEDEALS_CRON_SECRET`, uses a database lock, and
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

## Weekly membership and reciprocal Discord access (September 10, 2026)

Apply `supabase/migrations/20260910010000_heaterdeals_memberships.sql` after the Discord and push migrations. It adds the product-tier allowlist, an atomic primary-country claim, short-lived paid Discord grants, and ordered Apple transaction recording. The new weekly product includes one country; existing monthly subscribers retain Pro access. Pro is US $12.99/week for DE, UK, ES, FR, and IT, with an eligible 7-day trial across all five. Standard is US $4.99/week with an eligible 7-day trial for one selected domain.

`GET /pulsedeals/api/v1/membership` returns tier, source, primaryMarketplace, expiresAt. `PUT` with `{ "marketplace": "de" }` records the first country for an active member. Feed, details (including UUID lookup), alerts, votes, enqueue and dispatch check membership. Pro adds countries, never exclusive local deals.

Linking Discord only requires sign-in. Set `PULSEDEALS_DISCORD_PAID_ROLE_ID` (Standard) and optionally `PULSEDEALS_DISCORD_PRO_ROLE_ID` to roles controlled by the paid membership provider. They must differ from `PULSEDEALS_DISCORD_ROLE_ID`, which the app grants and revokes. Ordinary server membership and the app-granted role never unlock the app. The payment provider must remove paid roles after expiry. Role grants are verified with the bot API, cached for 10 minutes, and refreshed when older than 5 minutes. Failed checks do not extend access.

Run internal sync at least every 5 minutes, including when push is disabled. It reconciles up to 100 stale Discord links per run and removes expired app access roles. Scale batch size/frequency as needed. Unlinking removes the Discord-derived grant; independent Apple access remains. Update the APNs worker with the migration because it now rechecks `pulsedeals_membership` instead of one product ID.

Configure the live weekly product and one-week introductory offer in App Store Connect; the repository's StoreKit configuration changes local tests only. New/legacy product IDs are seeded in `pulsedeals_product_tiers`. Add explicit table entries for custom IDs or any additional future product. No deployment or live payment-provider setup is recorded by these local edits.

The current domain allowlist is DE/UK/ES/FR/IT throughout the API, Keepa adapter, and Worker scheduler. Keepa IDs are 3/2/9/4/8 respectively. The membership migration adds ES/FR/IT storage support and cancels legacy US/CA alerts/deliveries. Historical data stays stored. Both weekly product IDs are whitelisted; configure both introductory offers in the same Apple subscription group.

## Country requests

The app labels Canada and the United States as Coming soon and offers a searchable country-request sheet. They remain outside live marketplace access. Apply `supabase/migrations/20260911010000_pulsedeals_country_requests.sql` after the rename migration before releasing the new API route.

`POST /pulsedeals/api/v1/country-requests` accepts `{ "countryCode": "CA" }` from any signed-in account, without a subscription requirement. Requests are limited to 20 per account per hour, validated against the country/territory allowlist, and deduplicated by account and country. Current live countries cannot be requested. Only the service role can access stored requests; account deletion removes them automatically.

To review demand, aggregate `pulsedeals_country_requests` by `country_code` and count the rows. The feature stores requests only; it does not subscribe people to notifications or assign release dates. The API and real migration checks are in `tests/pulsedeals/country-requests.test.ts`.

## Referral weeks

Apply `supabase/migrations/20260911000000_pulsedeals_referrals.sql` after the rename migration. Configure the `referral-week` Apple promotional offers, server keys, environment, and feature flag before enabling claims. The full product rules, API contract, recovery procedure, and release checks are in the companion `PulseDeals/docs/referrals-rollout.md`. Billing uploads and Apple webhooks continue using the same entitlement RPC; it now records referral rewards atomically.


### Yearly billing

Apply `20260911030000_pulsedeals_yearly.sql` after the membership and rename migrations (and after referrals in the normal rollout order). It adds `com.pulsedeals.subscription.yearly` as Standard and `com.pulsedeals.subscription.pro.yearly` as Pro to the shared product-tier allowlist. Existing products and entitlements are preserved. The app offers Standard at US$89.99/year and uses a working Pro price of US$234.99/year, rounded from the weekly ratio; live prices and other storefronts still require App Store Connect configuration. Both yearly products use a one-year billing period, eligible one-week introductory trial, and the `referral-week` promotion in the existing subscription group. Local migration tests cover annual purchases, restores, renewals, upgrades/downgrades, refunds, country restrictions, and referral redemption product retention.
