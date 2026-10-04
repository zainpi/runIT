# runsIT — Company Website

A company homepage for runsIT, with links to Neutronium, PulseDeals,
The Last Echo, Local Lore, and Build Your Room on Roblox, plus profiles for the three founders and their portfolios.
Built with **Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion**.

The site is styled as **runsOS**: a playful desktop where products open as app
windows, templates live in a folder, and the dock and menu bar handle navigation.
It is mobile-first, SEO-optimized, accessible, and static-rendered for fast loading.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Production deployment

Production is deployed through the Cloudflare Workers Builds integration
connected to this repository. The public `runsit.ca` and `www.runsit.ca`
domains route to the `runit` Worker; the separate `runsit-ca` Worker is a
historical build target and does not hold the public production secrets.
Custom domains and routes stay managed in the Cloudflare dashboard. Pushing
the intended branch to `origin` triggers the live deployment for the configured
domains. When managing secrets manually, use `wrangler secret ... --name runit`.

Do **not** deploy production directly with `wrangler deploy` from a local
machine. Verify changes with `npm run build`, then commit and push them through
GitHub so the configured deployment pipeline remains the source of truth.

Neutronium is deployed separately on a DigitalOcean VPS; see [VPS instructions](deploy/neutronium/README.md). Its PostgreSQL database, sessions, and scheduler run there.

## Pages

| Route            | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `/`              | Company description, product links, founders, and contact         |
| `/pulsedeals/`  | PulseDeals overview, legal information, and support               |
| `/the-last-echo/` | The Last Echo game website                                       |
| `/local-lore/`    | Local Lore live Toronto geography game                                |
| `/neutronium/`   | Redirects to the Neutronium VPS on runsit.ca                       |
| `/zainpi/`, `/raishaikh/`, `/mikaelsid/` | Founder portfolios                     |
| `/services`, `/case-studies` | Redirect to the homepage products section            |
| `/about`         | Redirects to the homepage company section                         |
| `/contact`, `/book` | Redirect to the homepage contact section                       |
| `/api/contact`   | Lead intake endpoint (validates; ready for your provider)        |

## Customize / rebrand

Homepage content is configured in:

- **`src/lib/site.ts`** — company name, description, canonical domain, and email.
- **`src/lib/company.ts`** — product descriptions and destinations, and founder
  names, roles, and portfolio routes. The shared portfolio page is at
  **`src/app/[founder]/page.tsx`**; only the configured founder slugs are served.
- **`src/components/runsos/`** — the runsOS design system: menu bar, taskbar,
  windows, the interactive homepage desktop (`Desktop.tsx`) and per-product
  icons, artwork and colours (`apps.ts`).
- **`src/app/home.module.css`** — homepage sections, founder portfolios and the 404 page.

Legacy agency pages retain their content in **`src/lib/content.ts`**.

Colors, fonts, shadows, and animations live in **`tailwind.config.ts`** and
**`src/app/globals.css`**.

## Wiring up the lead form

The form posts to `src/app/api/contact/route.ts`, which validates the payload
and returns success. To go live, add your integration at the marked
**Integration point** — e.g. send an email (Resend/SendGrid), create a CRM lead
(HubSpot/Pipedrive), or POST to an automation webhook (n8n/Zapier). A hidden
honeypot field already filters basic bots.

## Calendar booking

The `/book` page includes a styled link to `site.calendarUrl`. To enable inline
scheduling, replace the `CalendarEmbed` block in `src/app/book/page.tsx` with
your provider's embed (Calendly / Cal.com).

## SEO & analytics

- Per-page metadata, canonical URLs, Open Graph + Twitter cards.
- Dynamically generated OG image (`src/app/opengraph-image.tsx`).
- `sitemap.xml` and `robots.txt` (generated).
- JSON-LD: `Organization` (global), `WebSite` (home), and visible FAQ, product,
  offer and breadcrumb data on public template pages.
- Each catalog template has a public `/templates/<id>/` page, linked from the
  homepage and store and listed in the sitemap. Paid prompts and private plans
  stay in the authenticated purchase flow.
- Route loading screens are scoped to the private library and trial. Public
  pages render without a streaming loading boundary so their text and links
  are visible without JavaScript, and invalid template URLs return HTTP 404.
- Verify search access and content with
  `npx playwright test --config tests/search/playwright.config.ts`; the checks
  include HTML without JavaScript, visible/schema price agreement in CAD/USD,
  sitemap discovery, private-route exclusions and unknown-template 404s.
  To check the production version, first build with
  `NEUTRONIUM_DIST_DIR=.next-aeo-build npm run build`, then run the same test
  command with `SEARCH_TEST_PRODUCTION=true`.
- After an explicitly requested deployment, submit `https://runsit.ca/sitemap.xml`
  in Google Search Console and Bing Webmaster Tools and inspect the new URLs.
  Check CDN/WAF logs for successful crawler requests; robots.txt permission
  alone does not establish access through bot protection. Track AI referrals
  and a consistent set of relevant queries over time. Recommendations and
  citations are not guaranteed by these changes. See
  [Google AI search guidance](https://developers.google.com/search/docs/appearance/ai-features)
  and [OpenAI search crawler guidance](https://developers.openai.com/api/docs/bots).
- **Set the production domain in `src/lib/site.ts` (`url`)** so absolute URLs,
  sitemap, and structured data are correct.
- Analytics-ready: drop your snippet into `src/app/layout.tsx` (e.g.
  `@vercel/analytics` or a `<Script>` tag).

## Accessibility

Skip-to-content link, keyboard-visible focus rings, semantic landmarks, labeled
form fields with inline errors, and `prefers-reduced-motion` support.

## Neutronium

Company IT administration lives at `/neutronium/`, with company, employee, and operator interfaces. Run `npm run dev` to open an isolated Acme development workspace, and `npm run neutronium:worker` in a second terminal for unattended local workflows.

See [Neutronium setup and architecture](docs/neutronium.md) for the database migration, production environment variables, Microsoft consent setup, demo walkthrough, and tests.

## Local Lore

Play the live game at [runsit.ca/local-lore/](https://runsit.ca/local-lore/).
It is served from `public/local-lore/` through a Next.js rewrite. The existing
site navigation links directly to the game. See [Local Lore deployment](docs/local-lore.md)
for its live API, saved progress, image limits, and update workflow.

## Higgsfield agent tool

The local coding agent can create short AI-template video ads with Higgsfield.
See [setup and commands](marketing/ai-templates/higgsfield/README.md). This tool is not exposed
through the website and does not deploy with it.

AI Templates campaign assets, copy, and research are organized in the
[marketing folder](marketing/ai-templates/README.md).
