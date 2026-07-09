# Ancient Horizon — Redeem page

Static page served at **`https://runs-it.com/ancient-horizon/redeem/`** (it lives in
`public/`, so Next.js serves it directly — no route/component needed). Players sign in
with their **runsID** (email one-time code) and redeem a promo/gift code; the reward is
delivered to their **in-game Mail** to claim inside Ancient Horizon.

## How it works

1. **Sign in (runsID):** email → `POST /auth/v1/otp` (`create_user:false`, existing
   accounts only) → player enters the emailed code → `POST /auth/v1/verify` returns a
   session JWT (kept in memory only, never `localStorage`).
2. **Redeem:** `POST /rest/v1/rpc/redeem_code` with `{ p_code }` + the player's JWT. The
   server RPC validates the code, records a one-per-player redemption, and inserts a
   `mail` row with the reward. No currency is granted client-side — the player claims it
   in-game (CLAUDE.md §13.3).

## Backend

Lives in the game repo: `AncientHorizon/supabase/migrations/016_redeem_codes.sql`
(`redeem_codes` table + `redeem_code()` / `admin_create_redeem_code()` RPCs). Apply it with
`supabase db push`, then mint codes as an admin:

```sql
select public.admin_create_redeem_code('WELCOME100', p_gems => 100, p_daily_tickets => 10);
select public.admin_create_redeem_code('LAUNCHDAY', p_gems => 500, p_max_uses => 1000,
                                        p_expires_at => now() + interval '30 days');
```

## Config

The `CFG` object at the top of `index.html` holds the Supabase project URL and the
**public anon key** (RLS-gated, safe to embed — same key shipped in the app). Repoint by
editing those two values.

For production email volume, configure custom SMTP in Supabase → Auth → SMTP (the built-in
mailer is rate-limited). No redirect URL needed — this page uses the code flow.

## Security (CLAUDE.md §5)

- `redeem_codes` has no client SELECT policy → codes aren't enumerable.
- `redeem_code()` granted to `authenticated` only — needs a real runsID JWT.
- One redemption per code per player, optional `max_uses` / `expires_at`, under a
  `FOR UPDATE` lock; rate-limited 10/hour/player.
- Reward delivered as system mail only; session JWT in memory, dies with the tab.
