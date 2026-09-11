# Local Lore on runsIT

Public game: https://runsit.ca/local-lore/

The custom domains `runsit.ca` and `www.runsit.ca` route to the **`runit`**
Worker. The repository currently triggers builds for both `runit` and
`runsit-ca`; the historical Wrangler default names the latter. Explicitly use
`--name runit` when managing the live game's secrets, and verify the
`Workers Builds: runit` check for production. Do not infer domain routing from
the Wrangler default alone.

Local Lore uses real Google Street View photos and Static Maps with 80
independently sourced OpenStreetMap locations:

| City | Intersections | Landmarks | Starting collection |
| --- | ---: | ---: | --- |
| Toronto | 17 | 5 | Downtown, near Spadina & Dundas |
| New York City | 14 | 7 | Midtown Manhattan, near Bryant Park |
| Vancouver | 14 | 6 | Downtown, near the Vancouver Art Gallery |
| London, UK | 10 | 7 | Central London, near Leicester Square |

All 58 new NYC, Vancouver and London targets passed Street View metadata and
camera-distance checks on September 11, 2026. The collection keeps OSM positions;
Google panorama positions are used only transiently to validate camera distance
and calculate the view heading.
Three-round daily, intersection practice, and landmark games use map pins,
clue penalties, reveals, and saved scores/notebooks. Desktop play keeps the
photo and map side by side with actions underneath in a viewport-sized layout.
Phones switch between Photo and Map in the same space; the site footer remains
on the other screens so the active round has room for the map and results.
The daily set follows each city's local date and gives the same places to all
players in that city. Players get one daily attempt per city per local day.
The 1 km landmark area has insufficient coverage and requires a wider radius.
That limitation applies to Toronto; coverage counts are calculated separately
for each city, mode and radius. Wider radii reuse each city's current collection;
this is not citywide coverage.

## Location and city selection

The setup screen recommends the closest supported city using Cloudflare's
trusted `request.cf` latitude/longitude when available. The response contains
only the recommended city and rounded distance, remains `private, no-store`,
and does not write the visitor's location to D1 or call Google Maps. Missing
or invalid network coordinates fall back to the first supported city.

If browser geolocation permission is already granted, the client automatically
refines the recommendation. Otherwise, **Use my location** requests permission
on a click. Browser coordinates are compared with supported city centres in
memory; they are never posted to the game API or stored. Denial, timeout, missing
browser support, and unavailable browser storage do not block play. A manually
selected city is remembered locally and takes priority until the player uses
automatic location again. Late location results cannot replace a manual choice
or change a round that has already started.

The supported city IDs are `toronto`, `nyc`, `vancouver` and `london` (UK).
Players elsewhere get whichever of these is nearest, not a game around their
exact coordinates. `src/lib/local-lore/live/cities.mjs` is exported for both
server and browser use and contains centres, allowed map bounds and IANA time
zones. The API persists the selected city, samples only that city's targets,
validates guesses and map requests against its bounds, and labels scores and
notebook entries by city. Resuming a game uses its saved city independently of
the currently selected city. Omitted city IDs from older clients mean Toronto;
unsupported IDs and request IDs reused for another city are rejected.

## Runtime and data

`worker.ts` dispatches `/local-lore/api/*` to
`src/lib/local-lore/live/api.mjs` before OpenNext. Public browser assets live
in `public/local-lore`; the homepage product card links directly to the game.
The Worker needs `LOCAL_LORE_DB` (Cloudflare D1), with numbered migrations in
`migrations/local-lore`. Wrangler tracks applied migrations. The existing
scheduled handler also expires old game/rate-limit data.

`LOCAL_LORE_GOOGLE_MAPS_API_KEY` is a Cloudflare Worker secret, never a public
JavaScript variable or repository file. Enable Street View Static API and Maps
Static API for the Google project; API restrictions must allow both. This is a
server-side integration, so browser-referrer-only restrictions do not work.
An optional `LOCAL_LORE_GOOGLE_MAPS_URL_SIGNING_SECRET` signs image URLs. Keep
these secrets out of logs, exports and commits.

A random HttpOnly, Secure, SameSite cookie identifies a browser player; only
its SHA-256 digest is stored in D1. Saved games/answers expire after 90 days.
There are no accounts, cross-device sync, or public rankings in this release.
Daily IP-derived hashes and request counters expire after two days. Client
scores and claimed clue status are ignored; guesses are scored and committed
once on the server. Future round identities and coordinates are not disclosed.
The independently sourced location collection itself is public under ODbL.

## Pin scoring

New guesses use `local_lore_live_v2` and the `neighborhood_pin_v2` profile.
Each round is capped at 1,000 points. A pin within 50 m earns full points;
otherwise the unassisted score is `round(1000 * exp(-(distance_m - 50) / 1000))`,
with zero at 6,050 m or farther. This gives about 951 points at 100 m, 638 at
500 m, and 387 at 1 km. The existing 20% clue penalty applies before rounding.
The same proximity curve applies to all live modes. The API retains named
answer compatibility for older open clients, but the current interface only
offers map guesses. Results save their rules version; already
submitted scores remain committed as originally earned.

## Image use and cost controls

Google image bytes are streamed with `private, no-store` and CDN no-store.
There is no disk, D1, R2, service-worker, or CDN cache of Google imagery.
Only panorama IDs are saved; free metadata verifies availability and refreshes
missing IDs using independently sourced coordinates. Lookups use a 50 m search
radius for intersections and 150 m for landmark footprints; cameras beyond
100 m and 150 m respectively are rejected. Google images retain
complete attribution and get an additional legible Google Maps text label.

The client requests one photo when a round opens and loads the initial map
automatically. The displayed map persists between guesses and rounds, and moving
a pin or showing the answer in the existing viewport makes no Google request.
Panning, zooming, centering, retrying, and reloading can request new images.

Atomic D1 counters limit this app to `LOCAL_LORE_IMAGE_DAILY_LIMIT=250` Google
image requests per UTC day, combined across Street View and Static Maps.
Additional limits: 48 images/player/day, 96 images/IP/day, 12 games/player/day,
30 games/IP/day, and 120 API calls/IP/minute. Failed image requests can consume
a reservation; counters fail closed. These are app limits, not Google-project
billing caps. Other apps using the key still count toward Google billing.
Image limits use UTC days; game-start limits remain shared across cities using
Toronto dates, so changing cities cannot multiply the existing game allowance.
Set Google Cloud API quotas as an additional project-level control if needed.

Google references:
- https://developers.google.com/maps/documentation/streetview/policies
- https://developers.google.com/maps/documentation/streetview/metadata
- https://developers.google.com/maps/billing-and-pricing/pricing

## Update and verify

The source workspace is `/Users/Zain/Developer/LocalLore`. Its `npm start`
serves the live handler with a local SQLite adapter at port 4173 (Node 22.14+).
An ignored `.env` supplies `GOOGLE_MAPS_API_KEY` for local development.
The old synthetic foundation remains separate from the live API.

Run `npm run verify` there, then
`node scripts/export-runit.mjs /path/to/runIT-checkout` to copy explicit public
assets, Worker modules and the migration. The exporter excludes secrets,
local databases, and the development server. Keep regression tests in this
checkout synchronized with the source workspace when changing API behavior.

In runIT, run `npm run test:local-lore` with Node 22.14+, then
`npm run build:cloudflare` (includes the required Next production build).
With the source preview running, `npm run test:local-lore:layout` checks the
pin-only interaction and viewport fit at desktop, short laptop, and phone sizes,
plus geolocation, permission failures, manual overrides and location privacy.
City browser checks also cover panning within the selected city's bounds,
pin submission, labels, and resuming a game after choosing another city.
Set `LOCAL_LORE_BASE_URL` to target another preview. Browser tests mock the game
API and imagery, so they do not consume Google image requests or saved attempts.
The live tests cover scoring, aliases, map projection, daily attempts,
clue penalties, player isolation, CSRF, idempotence, concurrent submissions,
future-round protection, image budgets, pano-only persistence, and expiry.
For local Worker HTTP testing, apply D1 migrations with `--local`, then use
`wrangler dev`; local credentials belong only in an ignored `.dev.vars`.

For schema changes, apply the versioned D1 migration with `--remote` before
releasing dependent code. Commit only the intended changes, then push through
the existing GitHub-connected Cloudflare Workers Builds pipeline. Do not use
local `wrangler deploy`. Wait for the `runit` build and verify the public
configuration, real images, three-round submission flow, and saved history.
Migration `0002_cities.sql` adds `city_id` with a constant Toronto default and
replaces the daily uniqueness index with `(guest_id, city_id, day_key)`. Existing
games, rounds and scores stay intact. The local adapter applies the same delta
to older local databases; regression tests verify preserved scores and indexes.

Once non-Toronto games exist, retain the multi-city reader and catalogue during
any rollback. Do not revert to a Toronto-only handler that cannot read those
saved games. Roll forward with a targeted fix or disable new starts while
keeping city-aware resume support. Preserve D1 data; do not drop tables or
restore an old backup over newly earned scores as a routine rollback.
