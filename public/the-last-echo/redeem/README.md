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

Apply with `supabase db push`, then mint codes as an admin:

```sql
select public.admin_create_redeem_code('WELCOME100', p_gems => 100, p_daily_tickets => 10);
select public.admin_create_redeem_code('LAUNCHDAY', p_gems => 500, p_max_uses => 1000,
                                        p_expires_at => now() + interval '30 days');
```

## Config

The `CFG` object at the top of `index.html` holds the Supabase project URL and the
**public anon key** (RLS-gated, safe to embed — same key shipped in the app). Repoint by
editing those two values.

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
