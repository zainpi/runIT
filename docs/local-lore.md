# Local Lore on runsIT

Public game: https://runsit.ca/local-lore/

The published version is the browser demo: nine sample rounds across three
modes, named answers, pin practice, clue penalties, reveals and scores.
Photos are illustrative stock images, maps and rankings are examples, and
progress is held in memory for the current page session. The page labels
these limits before play. Google location search, real Street View scenes,
accounts, persistent scores and live leaderboards are not connected.

## Update the game

From this LocalLore directory:

```sh
npm run verify
node scripts/export-runit.mjs /path/to/runIT-checkout
```

The exporter copies only the four public browser assets. No API server,
fixtures database, environment file or credential is published. The runIT
Next.js config rewrites `/local-lore/` to its static `index.html`, with relative
asset URLs to keep the game self-contained. Keep the game linked from the
company product list and site navigation.

In runIT, run `npm run build` (and `npm run build:cloudflare` when checking the
Worker bundle), commit just the intended game changes, then push through the
existing GitHub-connected Cloudflare Workers Builds pipeline. Do not deploy
with local `wrangler deploy`. Wait for the `runsit-ca` build check and verify
the public page and all four assets before reporting a successful release.
