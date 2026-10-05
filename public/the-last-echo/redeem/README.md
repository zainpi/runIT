# The Last Echo — Redeem page

Static page served at **`https://runs-it.com/the-last-echo/redeem/`** (it lives in
`public/`, so Next.js serves it directly — no route/component needed). Players enter their
**Player ID** (the public `#number` shown in the game under Settings) and a promo/gift
code; the reward is delivered to that account's **in-game Mail** to claim inside The Last
Echo.

## How it works

1. **Enter Player ID + code:** no sign-in. The page reads the 7-digit public account
   number (`account_number`, migration 022) and the reward code.
2. **Redeem:** `POST /rest/v1/rpc/redeem_code_by_number` with `{ p_number, p_code }` using
   the **public anon key only**. The server RPC resolves the player from the number,
   validates the code, records a one-per-player redemption, and inserts a `mail` row with
   the reward. No currency is granted client-side — the player claims it in-game
   (CLAUDE.md §13.3).

## Backend

Lives in the game repo:
- `AncientHorizon/supabase/migrations/016_redeem_codes.sql` — `redeem_codes` table +
  the authenticated `redeem_code()` / `admin_create_redeem_code()` RPCs.
- `AncientHorizon/supabase/migrations/027_redeem_code_by_number.sql` — the anon-callable
  `redeem_code_by_number(p_number, p_code)` RPC this page uses.

The 2.0 candidate is coordinated with the reviewed game migrations001–056,
058 identity/report contracts and059 progression gates; optional 057 analytics is
excluded. Use the game repository's migration manifest and staging/cutover runbook.
Do not blindly push the historical chain to an existing database, reset progression,
activate the wallet or send launch gifts as part of deploying these pages.

Code creation is an explicit admin action. The browser dashboard requires an
explicit sign-in to acquire a current server nonce, and the database rechecks admin
membership, release epoch, maintenance and nonce before canonical reward creation.
The public redeem pages keep the existing bounded anonymous account-number route.
Migration 056 records the admin-authored code origin; unverified progression reward
mail remains gated. Existing gold/core/dust mail is not canonical wallet authority.

A browser admin can enter maintenance from a current open session. After reset,
active nonces have been cleared and new gameplay sessions are blocked in maintenance.
Reopening therefore requires the reviewed trusted SQL/service runbook. The browser
and Discord bot must never silently reclaim a replaced session to recover a write.

## Config

The `CFG` object at the top of `index.html` holds the Supabase project URL and the
**public anon key** (RLS-gated, safe to embed — same key shipped in the app). Repoint by
editing those two values. `CFG.epoch` is the fixed official 2.0 epoch, sent as
`X-Game-Epoch: 2` on all four locale pages. It is a compatibility header; authorization
and reward proof remain server responsibilities.

## Security (CLAUDE.md §5) — deviation

This page uses `redeem_code_by_number`, which is **anon-callable** and identifies the
player **only by their public account number** (owner call 2026-07-16). This is a
deliberate **§5.3 security deviation** from the authenticated-only `redeem_code()` (016):

- The Player ID is display/reference data, **"never a credential"** (022 header), and is
  sequential + enumerable. So anyone who knows or guesses a number can redeem a **valid**
  code **into that account's mail** (griefing: burning a once-per-account code before the
  owner does, exhausting a code's `max_uses`, or mail spam).
- It is **not** account takeover and grants the attacker nothing — every reward lands in
  the **target's** in-game mail and is still claimed server-side. UUID + JWT/RLS remain
  the real security boundary.

Mitigations kept from 016: `redeem_codes` has no client SELECT policy (codes aren't
enumerable); one redemption per code per player; optional `max_uses` / `expires_at` under
a `FOR UPDATE` lock; reward delivered as system mail only. A per-number rate limit
(10/hour) blunts hammering a single account but does **not** stop cross-number
enumeration (accepted — sequential numbers are already enumerable, and a global limiter
would risk locking out legit players during a code drop). The authenticated
`redeem_code()` (016) is left intact as the secure path.

## Local verification 2026-10-04

- `node --test tests/the-last-echo/localization.test.mjs`: 46 localization/link/rate checks.
- `node --experimental-strip-types tests/the-last-echo/admin-release-contract.test.mjs`:
  80 session/epoch/account/error/storage/UI checks, including actual Supabase SSR wire headers
  against synthetic fetch. Production login/logout handlers are tested with controlled hooks
  and Auth adapters for reversed nonce replies, clear/logout/new-login races and duplicate
  submissions. The game client disables shared browser singleton reuse. The leaderboard
  shows an unavailable state while verified rankings are held; it makes no ranking fetch
  or rebuild request. This is not full mounted browser/provider Auth acceptance.
- `node tests/the-last-echo/redeem-contract.browser.mjs`: 108 real Chromium DOM checks
  across en/es/ko/ja with every backend/provider request intercepted. Tests cover the exact
  anonymous body/key/epoch, success/duplicate, maintenance/update errors, network recovery,
  duplicate Enter suppression, Harpenny legacy display and safe reward text rendering.
- `node node_modules/typescript/bin/tsc -p tsconfig.release-identity.json`: scoped admin
  TypeScript passes against current runIT lock versions; this is not a full site build.

These are local candidates, not deployed acceptance. Stage the SQL/Edge/game/web
versions together, then verify real managed permissions and current/stale sessions,
all four pages against a bounded test code/account, maintenance, Auth deletion cleanup
and interrupted requests. No production redemption or mail was sent by these tests.
