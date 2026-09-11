# PulseDeals rename rollout

These are release instructions for the local rename; no live migration, secret change, or deployment has been performed.

## Current names

- Product: **PulseDeals**. Public pages: `/pulsedeals/`, `/pulsedeals/privacy`, `/pulsedeals/terms`, `/pulsedeals/support`.
- API: `https://runsit.ca/pulsedeals/api/v1`.
- Code: `src/lib/pulsedeals`, `src/app/pulsedeals`, `scripts/pulsedeals`, `tests/pulsedeals`.
- Configuration: `PULSEDEALS_*`. Internal sync header: `x-pulsedeals-cron-secret`.
- Database tables and RPC names use `pulsedeals_`.

## Release sequence

1. Back up the database and pause the existing sync scheduler and APNs dispatcher. Coordinate a short API maintenance window: the prior server build uses the prior database names and must not continue handling requests after the rename migration.
2. Apply all existing PulseDeals migrations in timestamp order, through `20260910010000_heaterdeals_memberships.sql`, then apply `supabase/migrations/20260910020000_pulsedeals_rename.sql` once. Fresh databases follow the same sequence. Earlier migration filenames and SQL remain unchanged as migration history.
3. Release the updated API, middleware, Worker and public assets together, and start `tsx scripts/pulsedeals/dispatch.ts`. Resume scheduled sync only with the updated Worker. The rename uses `ALTER` to retain data, object identity, foreign keys, RLS, grants, and sequence ownership; it rewrites RPC bodies and refreshes the PostgREST schema cache.
4. Rename configured secrets to `PULSEDEALS_*`, preserving their existing values. In particular, **do not rotate the session secret as part of this rename**. Old `HEATERDEALS_*` values remain fallback configuration; when both names exist, the new name takes precedence. This applies to Cloudflare and the standalone APNs process. Secret values are never written into this repository.
5. Register `https://runsit.ca/pulsedeals/api/v1/discord/callback` in Discord before changing `PULSEDEALS_DISCORD_REDIRECT_URI`. Keep the previous redirect URI registered through the transition and allow in-flight OAuth flows to finish before changing that value. Existing explicitly configured legacy redirect URIs continue to work.
6. Update App Store Server Notifications V2 to `/pulsedeals/api/v1/webhooks/apple` and public legal/support URLs to `/pulsedeals/...`. Verify both old and new endpoint paths, authentication, membership, an alert write, purchase verification, Discord linking, and one physical-device notification before releasing the updated iOS app.

The legacy `/heaterdeals/api/...` path is internally rewritten to the new handler, preserving request methods, bodies, headers and query parameters. Old public URLs permanently redirect to the new pages. Both cron header names and valid, unexpired legacy session tokens remain accepted. These compatibility references and historical migrations intentionally retain the old spelling.

Apple bundle ID `com.pulsedeals.app`, product IDs, app URL scheme, Keychain namespace, app-account tokens, transaction identifiers and notification category IDs remain stable. Standard still includes one domain for $4.99/week; Pro includes DE/UK/ES/FR/IT for $12.99/week, each with its eligible seven-day trial.

If release verification fails, keep jobs paused and restore the database backup with the matching previous server release. Do not run an older server against the renamed schema.

## Local verification

Run `tsx --test tests/pulsedeals/*.test.ts`. Tests apply the real migration chain to a fresh database and upgrade an existing populated schema, verifying row/object preservation, membership, purchase identity, queue behavior, permissions, session compatibility, and URL rewrites.
