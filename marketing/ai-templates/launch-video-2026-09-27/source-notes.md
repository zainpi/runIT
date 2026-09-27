# AI Templates source notes

Research checked against the local application source on 2026-09-27. The public `/templates/` URLs did not load through the web research tool, so the composition follows the reviewed checkout rather than claiming live checkout availability.

## Offer and flow

- Storefront: `src/app/templates/store.tsx` and `src/lib/templates/catalog.ts` expose six choices: Discord bot, Roblox game, mobile game, mobile app, online store, browser game. The page says “Your idea. A head start.” and describes the intended result as a build guide, clickable HTML prototype, and coding AI prompt. Its metadata says no coding experience is needed to get started.
- Paid dashboard: `src/app/templates/library/ai-editor.tsx` has Plan, Build files, and Add-ons tabs beside AI chat. A customer enters an idea, receives one overview per template, refines it with 20 editing messages shared across an order, and explicitly applies a reviewed plan to the build prompt.
- Build files: `src/app/templates/library/build-guide.tsx` and `build-file-map.tsx` provide a downloadable complete HTML guide with setup, official resources, specification, acceptance checks, and a clickable **sample-data** prototype; they also expose the full `.txt` prompt to copy into a separate coding AI. The prototype is not a live app or backend.
- Optional extras: `src/app/templates/store.tsx` lists app icon creation (one icon plus three updates), AI teamwork (a multi-agent coordination prompt), and skills & tools setup (a separate setup prompt). The paid library exposes purchased extras individually.
- Launch help: `src/app/templates/managed-launch.tsx` offers separately quoted hosting/operations help for mobile app, mobile game, online store, and browser game projects. The prompt builder is labeled coming soon in `src/app/templates/prompt-builder-offer.tsx`; do not market it as available.
- Free trial: available by code, with a personalized plan and three AI edits; it does not include the paid complete guide.

## Claim discipline

“One full prompt to start building” accurately describes the copy/download flow. A one-shot promise of a finished application would overstate the product: an external coding AI must still implement and test the app, and external services may cost extra. The video uses a clearly labeled example project rather than showing a real customer result. It omits price and live checkout status because configuration and release can differ by domain and environment.
