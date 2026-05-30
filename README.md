# runIT — AI Automation Agency Website

A premium, conversion-focused marketing site for an AI automation agency.
Built with **Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion**.

Dark, high-end SaaS aesthetic, mobile-first, SEO-optimized, accessible, and
fully static-rendered for fast loading.

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

## Pages

| Route            | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `/`              | Home: hero, problem, services, benefits, process, testimonials, CTA |
| `/services`      | Detailed services with outcomes & use cases                      |
| `/case-studies`  | Example case studies with measurable results                     |
| `/about`         | Mission, approach, expertise, ROI commitment                     |
| `/contact`       | Contact details + full lead form                                 |
| `/book`          | Consultation booking: questionnaire + calendar slot              |
| `/api/contact`   | Lead intake endpoint (validates; ready for your provider)        |

## Customize / rebrand

Almost everything routes through two files:

- **`src/lib/site.ts`** — brand name, tagline, URL, email, phone, location,
  social links, navigation, and your **calendar booking URL** (`calendarUrl`).
- **`src/lib/content.ts`** — services, benefits, process steps, testimonials,
  and case studies.

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
- JSON-LD: `Organization` (global) + `ProfessionalService` with a service
  catalog (home).
- **Set the production domain in `src/lib/site.ts` (`url`)** so absolute URLs,
  sitemap, and structured data are correct.
- Analytics-ready: drop your snippet into `src/app/layout.tsx` (e.g.
  `@vercel/analytics` or a `<Script>` tag).

## Accessibility

Skip-to-content link, keyboard-visible focus rings, semantic landmarks, labeled
form fields with inline errors, and `prefers-reduced-motion` support.
