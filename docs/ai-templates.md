# AI template store

## Scope and architecture

The template store sells six downloadable AI build prompts from the existing Next.js/OpenNext application. The catalog and pricing live in `src/lib/templates/catalog.ts`; the complete prompt foundations live under `src/lib/templates/prompts/`; `compose.ts` adds the buyer's product brief and selected working mode. `content.ts` is the only server-side map from catalog IDs to full prompt text. Every prompt module and `content.ts` imports `server-only`, so full paid content must never be imported by a Client Component, serialized during static generation, or exposed by the public configuration endpoint.

The store has six API routes:

- `GET /api/templates/config/` reports whether Stripe and the included AI editor are configured, whether the key is in test mode, and the currency for the validated request origin. It returns no credentials or prompt content.
- `POST /api/templates/checkout/` validates same-origin JSON, one to six distinct catalog IDs, optional boolean `subagents` and `skillTree` selections that default to false for legacy clients, and a browser-generated 256-bit access token. The current storefront always supplies both booleans explicitly. It creates an idempotent Stripe Checkout Session and returns the hosted Checkout URL.
- `POST /api/templates/library/` requires the Checkout Session ID and the original access token. It retrieves the order from Stripe, verifies store/version metadata, the recorded CAD or USD currency and exact amount including independently selected add-ons, paid status, latest charge, refund/dispute state, and the access-token hash before returning purchased prompt foundations. It returns subagent or skill-tree instructions only when the verified order metadata includes the corresponding purchase.
- `POST /api/templates/trial/` redeems a trial code or validates an existing private trial link. It returns the selected catalog ID and allowance, never a paid foundation.
- `POST /api/templates/ai/` loads, generates, applies (paid only), or deletes a plan after verifying a paid order or redeemed trial.
- `POST /api/templates/webhook/` verifies the raw-body Stripe signature and handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Fulfillment records `delivery=available` in Checkout Session metadata. The webhook and browser return path call the same idempotent fulfillment operation.

Stripe is the durable order ledger. A separate SQLite-backed Durable Object now stores AI conversations and usage per purchase, while Checkout Session metadata records the purchased template IDs, catalog version, access-token hash, store marker, pricing currency/origin, and delivery state. Payment Intent metadata identifies the store, template IDs, add-ons, and pricing currency/origin. The browser retains the private access token in the fragment of the success URL; URL fragments are not sent to the server in HTTP requests. Store pages and API responses set `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`. All API responses use private no-store caching. The public store/library shells contain no paid content. The store renders dynamically so its initial prices and metadata match the request hostname; the browser then uses the same-origin configuration response.

On `runsit.ca` (including `www`), prices are CAD $9.99 for the first template, CAD $5.00 for each additional distinct template, CAD $5.00 for the optional subagent workflow, and CAD $10.00 for the optional skill tree. On `runs-it.com` (including `www`), the same numeric prices are charged in USD. Local development and configured staging origins default to CAD. This is fixed domain pricing, not exchange-rate conversion. Each add-on is charged once for the whole order and applies to every template in that order; neither is multiplied by template count. Prices are computed server-side as 999 cents plus 500 cents for every additional template, plus 500 cents once for subagents and 1,000 cents once for the skill tree when selected. Checkout uses inline `price_data` in the server-selected currency and explicitly disables Adaptive Pricing to keep the charged currency aligned with the storefront. It also explicitly sets `managed_payments.enabled=false`: this store uses standard Checkout, whose custom submit text, fixed currency, and exact-total verification are incompatible with an account defaulting to Managed Payments. runsIT retains responsibility for applicable taxes; Stripe is not the merchant of record for these sessions. Adopting Managed Payments requires updating the product tax codes, pricing presentation, and paid-order verification as a separate integration change. The `templates-standard-v1-` idempotency prefix keeps the revised request separate from older saved-cart requests while keeping subsequent retries stable. Library access independently recomputes and verifies both subtotal and total against the recorded `currency` and `pricing_origin` metadata. Legacy sessions lacking both pricing metadata fields remain valid only in USD. A buyer reopening a paid link is verified against the original order terms, regardless of the current storefront domain. Checkout idempotency and browser pending-cart keys include the currency, so an old USD checkout cannot be reused for a new CAD order. The browser supplies only catalog IDs, the private token, and two boolean add-on choices; it cannot supply prices, currency, arbitrary Stripe Price IDs, success URLs, or paid prompt content. Verified Stripe metadata, rather than localStorage or receipt fields, authorizes delivery of each paid add-on.

The storefront draft remembers both optional choices alongside the cart and editable brief, including across a canceled checkout. The private library enables “Include subagent workflow” and “Include skill tree setup” by default only for the verified entitlements on the active order. Buyers may omit an entitled workflow without losing the purchase, and switching between manual and computer-control modes preserves the choices. The skill-tree purchase also exposes separate Copy skill setup prompt and Download skill setup `.txt` actions so its installation guidance can be used independently from the application build prompt. Switching to another saved order must recalculate both entitlements from that order and clear any content that order did not purchase.

The skill-tree setup is an instructional artifact. It classifies and links relevant agent skills, MCP servers, plugins, CLIs, editors, and built-in capabilities without presenting them as interchangeable. It must verify current primary sources, supported hosts, versions, licenses, permissions, executable hooks, and installation mechanisms before recommending installation. Third-party skills and tools retain their own licenses, terms, accounts, usage fees, and security responsibilities. Buying this prompt does not install software, provide AI credits, grant model or computer-control access, create third-party accounts, or guarantee that a buyer's agent supports a named skill, MCP server, model, subagent, editor bridge, or plugin. Unsupported capabilities must fall back to clear manual steps.

The storefront and purchased library include our recommended AI setup: GPT-6 Astra with High thinking for the initial build, Medium for routine edits, and Extra High or Max for difficult problems. This is a practical recommendation for these templates, not a claim of comparative benchmark results. The guide explains time/token tradeoffs, account-dependent options, separate AI access, and that buyers select the model and reasoning level in their AI tool; pasted prompt text does not change those settings. Source guidance checked on 2026-09-16: https://developers.openai.com/api/docs/models/gpt-6-astra and https://learn.chatgpt.com/docs/agent-configuration/subagents#choosing-models-and-reasoning.

Every composed app prompt requires FOLLOW_UP_PROMPTS.md in the buyer’s project root, created after the first working milestone and refreshed through handover. It contains 8–12 app-specific, copyable follow-ups with prerequisites, expected results, current progress and priority next steps. Each prompt restores project context and preserves the chosen working mode and authorization boundaries. Computer mode writes the file when tools permit; manual mode provides the complete content and save instructions. The standalone skill setup prompt adds 4–6 setup-specific follow-ups to the same file, preserving existing app sections and customer notes. The guide is linked from README.md; its suggestions are not automatically executed.

## Adaptable foundations and included AI editing

The brief determines the product. Every composed prompt now asks for a brief-specific overview and feature table before implementation, with explicit requirements, provisional assumptions and unresolved decisions. Each foundation identifies its worked examples as optional: native service feeds, idle RPG mechanics, Roblox room decoration, geography maps, local delivery and commerce bot scanners must be replaced or omitted when irrelevant. The existing engineering, safety, testing and handover requirements remain applicable to the selected modules.

`POST /api/templates/ai/` serves the AI workshop on the existing private purchase URL. It accepts `load`, `overview`, `message`, `apply` and `clear` actions. Every paid action verifies the full Stripe order and its access token, including refunds/disputes. Trial actions verify their separate durable entitlement. Both enforce the request origin. Generation verifies ownership again before delivery. Neither the Session ID, access token, purchase URL nor add-on content is sent to OpenAI. Customer input cannot select another provider URL, model, foundation or message allowance.

Each valid purchase, including an existing verified purchase, receives **one free overview per purchased template plus 20 customer messages shared across the order**. New Checkout Sessions record `ai_messages=20` and `ai_overviews=one_per_template` as purchase terms; counters are authoritative in storage, never browser state or client metadata. The private URL is unchanged. Reading, applying, copying, downloading, switching devices and refreshing do not consume messages. Deleting AI content does not restore messages or free overviews. Copying a private URL grants access to its AI history and remaining allowance too.

The customer fills in the brief and explicitly selects the OpenAI consent checkbox before generating. The initial response contains an overview, feature table, assumptions and questions. Messages revise that proposed specification. **Apply plan to my prompt** saves the reviewed specification and adds it to the locally composed download without replacing the fixed foundation, build mode or purchased add-ons. Merely generating a revision does not apply it. Changing the manual brief excludes a previously applied plan until the customer updates/reviews it. The saved AI brief and applied plan restore across devices. Manual form changes remain browser-local until submitted to AI.

`TEMPLATES_AI_ORDERS` binds the exported `TemplateAiOrder` class in `worker.ts`. The `templates-ai-v1` migration in `wrangler.jsonc` creates its SQLite-backed namespace when an authorized deployment happens. One object is named by a SHA-256 digest of the verified Stripe Session ID; it stores no bearer credential. Synchronous SQLite transactions reserve a generation before a provider call. One request per purchase may be pending. Request fingerprints prevent changed-body retries and completed IDs replay without another provider call. Expected revisions prevent another tab from silently overwriting newer work. Responses have a 120-second provider deadline, a 180-second reservation lease, bounded input/output, a 25,000-token output ceiling for explicit reasoning (5,000 when omitted or `none`), a three-second send cooldown and at most 60 generation attempts per purchase. Failures refund reserved customer messages; expired leases recover on the next read or write and fence late completions. The attempt ceiling still bounds repeated free failures. A support decision is needed after that ceiling; do not reset quota casually.

Generation uses OpenAI Responses with strict structured output, `store:false`, no tools, the selected foundation, the submitted brief, the current plan and the latest six conversation entries. Responses are validated and rendered as React text, never HTML. Model/provider errors are not logged or returned verbatim. Prompts and messages must not be added to analytics or request-body logs. `store:false` disables stored response state; it is not a promise of zero provider retention. Review [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data) for the configured project.

AI content is retained with the purchase until the customer uses **Delete saved AI content**. This removes submitted briefs, plans and chat entries from current application state; minimal counters and request fingerprints remain to enforce purchased usage. Cloudflare's recovery history can retain previous state for its recovery window. The customer can download a plan/chat JSON export before deletion. A restored database must not resurrect deleted content or reset consumed quota; inspect the previous and restored usage ledger and deletion requests before serving a recovered object.

### Configuration and release

No service has been provisioned, funded or deployed by this implementation. Existing secret files must be preserved. Add these values to protected runtime configuration on the intended staging Worker, then separately on the intended production Worker when release is authorized:

- `TEMPLATES_OPENAI_API_KEY`: a dedicated server-only OpenAI project key. Never use `NEXT_PUBLIC_` or a key belonging to another application.
- `TEMPLATES_AI_MODEL=gpt-5.6-luna`: the owner-selected model, supporting Responses structured output. The runtime still requires an explicit model value.
- `TEMPLATES_AI_REASONING_EFFORT=max`: the owner-selected reasoning level, sent as `reasoning.effort`. Allowed values are `none`, `low`, `medium`, `high`, `xhigh`, and `max`; the configured model must support the selected value. Blank/omitted keeps the model default. Invalid values pause generation and new checkout/redemptions instead of silently falling back.
- `TEMPLATES_AI_ENABLED=true`: generation switch. Missing/false disables new generations while existing paid downloads, saved AI reads, apply and deletion remain available when storage is bound.
- `TEMPLATES_AI_ORDERS`: the generated Durable Object binding, configured in Wrangler rather than a secret.

GPT-5.6 Luna with Max reasoning is supported according to the [official model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna), checked 2026-09-17. Explicit reasoning levels other than `none` receive a 25,000-token output ceiling shared by internal reasoning and visible output; omitted/`none` retains the existing 5,000-token ceiling. This follows the initial headroom guidance in [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning). The provider timeout is 120 seconds and the durable reservation lasts 180 seconds, leaving time for entitlement re-verification and saving. Max can require more time and billable tokens; live latency, account access and plan quality still require provider validation.

New checkout is paused unless Stripe and all AI configuration are present, so a new customer is not sold an editor that has not been configured. This readiness check verifies configuration, not live model access or billing. Perform a controlled staging provider smoke test before enabling real sales. Existing paid template downloads do not require AI availability. Set project-level API budgets/alerts and monitor failures and storage/AI costs; per-purchase limits do not replace an operator budget.

Local checks require no paid provider calls:

```sh
npm run types:cloudflare
npx tsc --noEmit
npm run test:templates
npm run test:templates:browser
npm run lint
npm run build:cloudflare
npx wrangler deploy --dry-run
```

The generated binding declarations use module-scoped `@cloudflare/workers-types`, avoiding Worker DOM globals in the Next.js app. The Node test suite tests authorization, caps, retries, failures and the provider payload using fakes. A separate Miniflare test exercises the actual SQLite object, concurrent reservation, cross-order isolation and persisted restart. Browser tests use synthetic paid orders and AI responses, including the BoulderMe feature table. Plain `next dev` without a Cloudflare binding displays an unavailable AI editor; for real local binding checks use the built Worker with `wrangler dev` and isolated local persistence. Do not configure remote bindings for local tests.

Before an authorized release: verify the target Worker, retain its current version and storage recovery point, stage the class migration and protected settings, test a paid **test-mode** return link, generate one real overview and revision within an approved API budget, apply/download, reopen the link on another device, and verify refund denial, content deletion and exhausted usage. Check both `.ca` and `.com` purchase flows. Preserve the namespace and migration tag during rollback; pausing generation is safer than deleting or recreating stored quota. Restoring an older Worker alone does not restore or roll back Durable Object state. Recheck provider access and all live acceptance criteria rather than claiming these from fixtures.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Cloudflare SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Miniflare Durable Objects](https://developers.cloudflare.com/workers/testing/miniflare/storage/durable-objects/), [Worker bindings and types](https://developers.cloudflare.com/workers/languages/typescript/).

## Free-trial code

The storefront has a compact **Free-trial code** field and Redeem button directly above checkout in the order summary. A single selected template is used automatically; after entering a code, a template picker appears if the cart has zero or multiple templates. Each redemption chooses one template and includes **one free overview plus 3 editing messages**. A separate `/templates/trial/#session_id=…&access=…` page shows the overview, feature table, chat, remaining allowance, downloadable plan/chat and private-link save controls. Full foundations, add-ons and applying a plan to a purchased build prompt remain locked. The trial model receives only the public catalog description; paid foundation content never enters its context. Trial and purchased conversations remain separate; customers can export their trial decisions.

The initial campaign allows **50 total successful redemptions**, shared across domains and devices served by the same Worker. This counts trial links, not unique people: someone with the shared code can redeem more than once, up to the overall cap. No payment information is required. The code's SHA-256 digest is embedded only in the server-side `trial-codes.ts`; the shareable plaintext code was handed to the owner separately and is not included in public assets or config responses.

`TemplateTrialCodes` uses a single SQLite Durable Object (`template-trials-v1`) to serialize redemption. Its transaction checks for a prior redemption with the same access-token hash, checks the durable row count, then inserts one entitlement. Network retries with the same token recover the original link without using another redemption, including after the campaign reaches 50. Changing the template on an already redeemed token is rejected. Code matching ignores leading/trailing whitespace and case. Invalid codes and unavailable AI configuration consume no redemptions. Deleting AI content does not delete the entitlement or reset either limit. Existing links continue after all 50 redemptions are used.

The browser saves a random 256-bit access token before redeeming; the server stores its hash, selected template and creation timestamp. The token lives in the private URL fragment and is submitted only in same-origin POST bodies. Each trial has its own AI Durable Object and a server-enforced 3-message limit (plus at most 12 generation attempts, including failures). Provider failures refund reserved AI messages; they do not create another trial or refund an already issued link. Trial tokens cannot be used at the paid library endpoint, and client-supplied quota/template overrides grant no access. No email or login is collected, so save-link controls are the recovery mechanism.

To enable on a future authorized deployment:

- Apply the Wrangler migration `templates-trial-v1` and bind `TEMPLATES_TRIAL_CODES` to `TemplateTrialCodes`, alongside the existing AI order binding.
- Configure the AI provider as above and set `TEMPLATES_TRIAL_ENABLED=true`. Stripe is not required for trials. Readiness checks configuration only; validate provider access before distributing the code.
- Setting `TEMPLATES_TRIAL_ENABLED=false` pauses new redemptions while existing trial links, saved content and remaining messages continue working. `TEMPLATES_AI_ENABLED=false` pauses generation for both purchases and trials.
- Retain both Durable Object namespaces through releases and recovery. Replacing the registry, resetting local persistence, or deploying to a different Worker/environment creates a separate counter. Do not reset production state to renew the code.

The trial has not been deployed or enabled. Local tests use isolated persistence and synthetic credentials and do not consume any production redemptions.

## Internal provenance

This section is an internal engineering record and may name local source projects. The customer-facing prompts are clean-room, generic foundations: they contain no private product names, production IDs, credentials, user data, private domains, exact proprietary copy, or original assets.

- **Discord bot:** informed by `/Users/Zain/Developer/KeepaBot-test`. The template generalizes its complex automation architecture into a multi-server bot with owner-selected APIs, databases, spreadsheets, files, feeds and webhook adapters; optional AI answers, summaries and scoring; quota controls, durable delivery, and Discord operations. Commerce scanners remain optional example modules. The beginner runbook covers every selected service with official URLs, connection checks, hosting and maintenance, while replacing private configuration and business rules.
- **Roblox game:** informed by `/Users/Zain/Developer/Build_Your_Room`. The template retains reusable server-authoritative placement, inventory, progression, reliable DataStore, multiplayer presentation, and receipt-processing patterns without project content or IDs.
- **Mobile game:** informed by `/Users/Zain/Developer/AncientHorizon`. The template uses original placeholders and makes backend, billing, native authentication, notifications, and ads explicit optional modules.
- **Mobile app:** combines reusable foundations from `/Users/Zain/Developer/PulseDeals`, its API in this repository, and `/Users/Zain/Developer/recipie`: native SwiftUI state, StoreKit/APNs flows, local-first editing, Share Extension persistence, revision conflicts, durable imports, provider adapters, and consented AI proposals. Product-specific deal and structured-content workflows remain optional generic modules.
- **Online store:** informed by `/Users/Zain/Developer/Baked@Midnight`. The template generalizes catalog, cart, Stripe Checkout, webhook fulfillment, service-zone, privacy, accessibility, and operations patterns without the original brand, menu, address, pricing, domain, or identifiers.
- **Browser game:** informed by `/Users/Zain/Developer/LocalLore` and the corresponding `local-lore` implementation in this repository. The template generalizes server-authoritative rounds, anonymous access, D1 quotas, map imagery, location privacy, attribution, and catalog verification without real coordinates, region catalogs, branding, or production bindings.

Public demo links are separate from paid prompt content. The online store links to Baked@Night at https://baked-at-night.pages.dev/ (verified storefront HTML on 2026-09-16); no private brand or deployment URL is included in the generic downloadable foundation.

## Prompt builder preview

The homepage and template store also introduce an upcoming prompt builder for
people making multiple apps. The offer lives at `/templates/#prompt-builder` and
shows $16.99 in the storefront's CAD or USD currency every 2 weeks (14 days).
It is explicitly a preview: the CTA opens an access enquiry email and does not
start checkout or subscribe anyone. Creative directions, more project prompts
and editable briefs are presented as planned features. No prompt quota,
unlimited usage, AI generation credits or cancellation policy is promised.
The existing one-time template cart and payment verification are unchanged.
The builder itself, subscription checkout, recurring access checks and billing
management still need implementation before this can become a purchasable plan.

## Stripe staging setup

No Stripe key is currently configured, and reconnecting Stripe remains outstanding. Do not perform live-mode operations as part of this implementation pass. Configure and verify test mode first.

1. In the Stripe test-mode Dashboard, create a restricted key for this store. Store it as `TEMPLATES_STRIPE_KEY`. The code accepts `rk_test_...` and `sk_test_...`, but a restricted key is preferred.
2. Give the restricted key Checkout Sessions read/write access. Order verification expands the Payment Intent's latest Charge, so grant Payment Intents read and Charges read. Checkout currently supplies inline `price_data` and `product_data`; depending on Stripe's current restricted-key permission enforcement, Products and Prices write access may also be required. Verify this in test mode by creating a real test Checkout Session. If Stripe does not require those permissions, remove them. If the desired least-privilege key cannot create inline prices, change the implementation to pre-created test Prices before live launch rather than broadening unrelated permissions.
3. Create a webhook endpoint for the staging origin at `https://STAGING_ORIGIN/api/templates/webhook/`. Subscribe only to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Store that endpoint's signing secret as `TEMPLATES_STRIPE_WEBHOOK_SECRET`.
4. Set `TEMPLATES_SITE_URL` to the canonical staging origin, such as `https://staging.example.com`, without a path. The server accepts that normalized origin plus the four exact HTTPS public origins (`runsit.ca`, `www.runsit.ca`, `runs-it.com`, `www.runs-it.com`). POST requests must have an Origin matching their own request URL and must not be cross-site. Redirects return to that verified request origin. Arbitrary hostnames, lookalike suffixes, and forwarded-host overrides cannot select a currency or return address. Keep both apex domains attached to the Worker in Cloudflare; custom-domain bindings are dashboard-managed.

The exact runtime variables are:

```text
TEMPLATES_STRIPE_KEY=rk_test_REPLACE_IN_PROTECTED_RUNTIME
TEMPLATES_STRIPE_WEBHOOK_SECRET=whsec_REPLACE_IN_PROTECTED_RUNTIME
TEMPLATES_SITE_URL=https://staging.example.com
```

Do not put real values in `.env.example`, source, screenshots, issue text, chat, shell history, or logs. For local development, use an ignored environment file. In the Cloudflare OpenNext deployment, add the values as encrypted runtime secrets or protected variables. `src/lib/templates/server.ts` loads deployed bindings through `getCloudflareContext().env` and falls back to `process.env` for local Node execution. Verify the exact deployed Worker/environment before adding or rotating values.

Official references:

- Stripe restricted keys: https://docs.stripe.com/keys#limit-access
- Stripe Checkout: https://docs.stripe.com/payments/checkout
- Checkout currency and Adaptive Pricing parameters: https://docs.stripe.com/api/checkout/sessions/create
- Stripe webhook signatures: https://docs.stripe.com/webhooks/signature
- Stripe testing: https://docs.stripe.com/testing
- Cloudflare Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- OpenNext Cloudflare bindings: https://opennext.js.org/cloudflare/bindings

Before production, add request-rate limiting for `/api/templates/checkout/`, `/api/templates/library/`, `/api/templates/ai/` and `/api/templates/trial/` in Cloudflare WAF. The application currently validates origin, input shape and size, but it does not provide a durable distributed rate limiter. Apply conservative per-IP limits with a documented support bypass or tuning procedure, test them against ordinary checkout retries, and monitor blocks. The webhook route should remain reachable by Stripe and rely on signature verification; do not apply a browser-only same-origin rule to it.

## Test and release gates

Run unit and integration tests, lint, TypeScript checks, the Next.js build, and the Cloudflare/OpenNext build. Test checkout with Stripe test cards and verify these cases:

1. Verify both public domains: one template costs $9.99 CAD on `.ca` and $9.99 USD on `.com`; six cost $34.99 in that domain's currency. Skill-tree-only totals are $19.99 and $44.99; subagent-only totals are $14.99 and $39.99; selecting both produces $24.99 and $49.99. Each add-on appears once per order regardless of template count.
2. Duplicate or unknown template IDs, malformed tokens, non-JSON bodies, oversized bodies, and cross-origin requests are rejected.
3. Repeating the same checkout request returns the idempotent Stripe result rather than creating accidental duplicate sessions. Changing currency separates the pending checkout and idempotency key.
4. Successful card payment returns to My templates and reveals only purchased prompts when both the Session ID and private token match.
5. Invalid webhook signatures fail; both supported paid events mark delivery available; duplicate webhook delivery is harmless.
6. Incomplete, expired, wrong-version, wrong-currency, or amount-mismatched sessions do not deliver.
7. A refunded or disputed Charge disables future library fetches. Previously copied or downloaded prompt files are irrevocable and cannot be remotely deleted.
8. API responses use no-referrer and no-store behavior and browser pages use no-referrer, and no full prompt appears in public bundles, source maps, config responses, page HTML, or unauthenticated API responses.
9. Checkout always sends both boolean add-on flags but no client amount or prompt text. Refresh and cancellation preserve the independent selections. Verified orders expose only their purchased workflows and separate skill-setup copy/download artifact; forged browser storage cannot expose either add-on, and selecting another saved order clears any entitlement it lacks.

These checks prove only local behavior and Stripe test-mode integration. They do not prove live restricted-key permissions, live card acceptance, production webhooks, refunds/disputes in live mode, WAF behavior, Cloudflare secret attachment, tax treatment, accounting, legal terms, or production recovery. Complete those separately before enabling live checkout.

There is no automatic email delivery. Stripe-hosted receipts may be enabled in Stripe settings if desired; confirm their branding, support contact, and legal wording in test mode. Customers must save the private return link or download the prompts after payment.

Each order has a reusable private URL containing its unique Checkout Session ID and random access token in the fragment. The library keeps that full URL in the address bar so bookmarking works, updates it when switching orders, and displays a prominent save reminder, a selectable URL field, a copy button, and a downloadable access file. The cart and Stripe Checkout also remind buyers to save the URL. A saved full URL restores the order on another device without relying on browser storage; manual brief edits stay local, while submitted AI briefs, conversations and applied plans are saved with the order; customers should also download edited prompts to keep their own copy. Hash-only navigation opens the corresponding order, and stale responses cannot replace a newer selection. Access still requires a verifiable paid order and remains subject to refunds or disputes; no unconditional lifetime-availability claim is made.

## Support recovery

Treat every library URL as a bearer secret. Never paste it into public tickets, analytics, logs, chat rooms, or screenshots. Support should first verify the purchaser using the Stripe receipt and the matching Checkout Session in the Dashboard.

The Checkout Session's stored `success_url` contains the original private access token and the literal `{CHECKOUT_SESSION_ID}` placeholder. After receipt verification, an authorized operator can recover the private link by copying `success_url` from that specific Session and replacing the placeholder with the actual Session ID. Send the reconstructed link only through an approved private support channel. Do not print it in terminal output or application logs, and do not store a second plaintext copy in metadata.

If the Session metadata is malformed, the amount or version does not match, payment is incomplete, or the Charge is refunded/disputed, do not reconstruct access. Escalate with the Stripe receipt and Session ID only. Refunds and disputes pause future API delivery, but any prompt already copied or downloaded remains outside technical recall.

## Operations

Daily checks should cover Checkout errors, webhook failures, unexpected payment states, and support requests without inspecting private access links. Weekly checks should review Stripe event delivery, WAF rate-limit activity, Checkout conversion, refunds/disputes, and Cloudflare errors. Monthly checks should review dependency/security updates, restricted-key permissions, operator access, legal copy, privacy behavior, catalog versioning, prices, and a staged recovery drill.

Rotate the restricted key and webhook signing secret through the protected Cloudflare runtime, deploy staging, verify config and a complete test purchase, then promote the same reviewed code and separately configured live secrets. Never mix test and live key/endpoint pairs. A code rollback does not erase Stripe orders; keep readers compatible with the purchased catalog version or provide a reviewed migration/recovery path. If checkout must be paused, remove or invalidate the runtime key so `/api/templates/config/` reports unavailable while preserving Stripe order history and support recovery.

## Local verification on 2026-09-16

- `npm run test:templates`: 57 tests passed (55 Node tests plus two SQLite Durable Object runtime/restart tests) (composition, sanitization, base and add-on pricing in CAD/USD, exact-origin checks, saved pricing metadata and legacy USD access, routes, and signed webhooks using a synthetic Stripe transport).
- `npm run test:templates:browser`: 25 browser cases passed, including 3 trial flows (CAD/USD labels and totals, all base/subagent/skill-tree price combinations, modes, persistence and cancellation, mocked checkout/library, server-authoritative add-on access, cross-order entitlement clearing, separate skill-setup copy/download, bookmark/cross-device/blocked-storage recovery, hash navigation and stale-response protection, keyboard interaction, and desktop/mobile overflow).
- `npm run lint`, `npx tsc --noEmit`, and `git diff --check` passed.
- `npm run build:cloudflare` passed in an isolated local source copy with independent dependencies, including the Next.js production build and its lint/type checks. Wrangler dry-run passed with both `TemplateAiOrder` and `TemplateTrialCodes` bindings. Existing compatibility-date and third-party bundle warnings remain.
- Production Next browser hydration and selection/mode controls passed with no page errors. Local Wrangler checks with `--local-upstream runsit.ca` and `--local-upstream runs-it.com` confirmed matching CAD/USD in both the rendered production page metadata and `/api/templates/config/`. Plain Next development reconstructs API request URLs using its loopback host, so overriding only the HTTP Host header is not a valid two-domain API simulation; use the local Cloudflare adapter for this check.
- A targeted scan of 104 public Next/Cloudflare JavaScript, HTML, JSON and source-map assets found no trial code/digest, private foundation adaptation text, AI system prompt or API-key variable name.
- Trial checks cover simultaneous redemption of exactly 50 uses, idempotent recovery after exhaustion, restart persistence, invalid/unavailable codes, origin/token binding, trial-vs-paid authorization, 3-message enforcement after deletion, public-only provider context and mobile layout.
- AI checks cover the free-overview and 20-message allowance, paid-order authorization, consent, revisions, retry replay, timeout/failure refunds, order isolation, stored restart recovery, deletion without quota reset, feature-table rendering, applying a plan, and lost-response recovery. The browser suite uses port 3102 and a separate build directory.
- No deployment, real Stripe charge, account configuration, live webhook, or external provider validation was performed. Checkout remains unavailable until protected Stripe and AI configuration is supplied. AI quality, model access and live provider billing remain unverified.


## Luna Max verification on 2026-09-17

The integration sends the configured model and reasoning effort separately. The synthetic provider test verifies `gpt-5.6-luna` with `reasoning: { effort: "max" }`, structured JSON output, the reasoning/output token ceiling, and `store:false`. Invalid effort values disable new generation; omission preserves existing model-default behavior. Lease tests cover the extended provider window and expiration/refund behavior. This configuration has not been deployed or tested against a live OpenAI project.
