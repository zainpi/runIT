# Meta ads plan: notes-app-ideas

Meta ad account `act_1676682065774333`, managed through the Adspirer connector
(15 actions a month; creating this campaign takes 2). Everything is created
**PAUSED**. Nothing spends until the budget is approved and the campaign is
switched on.

## Before the campaign can be created

1. **Facebook Page:** create or choose the runsIT Page and link it to the ad
   account (Business Settings → Accounts → Ad accounts → Add assets → Pages).
   To run on Instagram too, connect the Instagram account to that Page.
2. **Pixel (dataset):** Events Manager → Connect data → Web → name it
   "runsIT templates" → set up manually. Copy the numeric Pixel ID, and assign
   the pixel to the ad account.
3. **Conversions API token:** Events Manager → the pixel → Settings →
   Conversions API → Generate access token.
4. **Site configuration (Cloudflare):**
   - `NEXT_PUBLIC_META_PIXEL_ID` = the Pixel ID, as a build variable (it is
     compiled into the page and the security headers)
   - `META_CONVERSIONS_API_TOKEN` = the token, as an encrypted secret
   - optional `META_TEST_EVENT_CODE` from Events Manager → Test events, while
     checking; remove it afterwards
   - then merge and deploy
5. **Domains:** verify runsit.ca and runs-it.com in Business Settings → Brand
   safety → Domains.
6. **Check:** open runsit.ca/templates/ and add a template. Events Manager
   should show PageView, ViewContent, AddToCart, and InitiateCheckout at
   checkout. A real or test purchase shows Purchase (server).

## What the site sends

| Event | Where | Data |
|---|---|---|
| PageView, ViewContent | store page (browser) | template list |
| AddToCart | adding a template (browser) | template, price, CAD/USD |
| InitiateCheckout | "Continue to checkout" (browser) | templates, cart total |
| Purchase | Stripe webhook → Conversions API (server) | verified order total and currency, hashed email/country, `_fbp`/`_fbc`, event_id = Checkout Session ID |

Private purchase and trial pages never load the pixel, because their URL
holds the buyer's access key.

## Campaign (created paused)

- **Campaign:** "runsIT templates · notes-app-ideas", objective **Sales**
  (`OUTCOME_SALES`), budgets set per ad set (no campaign budget
  optimization), so each country's spend stays under our control.
- **Optimization event:** start on **InitiateCheckout**. A new pixel with
  a $9.99 product won't reach Meta's ~50 purchases a week per ad set for a
  long time, and optimizing for Purchase with a handful of sales starves
  delivery. Switch both ad sets to **Purchase** once each gets about 15–20
  purchases a week.
- **Ad set CA:** Canada, landing page `https://runsit.ca/templates/` (CAD).
- **Ad set US:** United States, landing page
  `https://runs-it.com/templates/` (USD).
- **Audience:** Advantage+ audience, ages 18–65, all genders, no interests.
  Broad targeting lets the creative find buyers; narrow interests at this
  budget mostly raise costs.
- **Placements:** Facebook and Instagram (no Audience Network), Reels-optimized
  since the video is 9:16.
- **Creative:** `ads/deliverables/notes-app-ideas/notes-app-ideas.mp4`
  (the version with our original music bed), thumbnail `poster.png`, CTA
  **Shop now**. Copy is a Dynamic Creative test of the variations below.
- **Tracking:** `utm_source=meta&utm_medium=paid_social&utm_campaign=notes-app-ideas&utm_content={{ad.name}}`
- **Budget:** not decided yet. It's a placeholder while paused, set before
  launch.

### Primary text (Meta tests these)

1. Every app idea you've ever had is still in your notes app. Pick a template, describe your idea, and AI turns it into a real plan, a step-by-step build guide and a clickable prototype. From $9.99.
2. Stop letting ideas rot in your notes app 💡 Get an AI plan, a step-by-step build guide, a clickable prototype and ready-to-paste prompts for your AI coder.
3. Discord bot, Roblox game, mobile game, mobile app, online store or browser game. Every order includes an AI plan, 20 AI edits, a build guide with a prototype and downloadable prompts. From $9.99.

### Headlines

1. Your idea. A head start.
2. Turn your app idea into a build plan
3. AI build templates from $9.99

## How to judge the test

- **Break-even:** revenue per order is about $10–15 (first template $9.99,
  plus $5 per extra and the add-ons), before Stripe fees. Cost per purchase
  has to land under that for the ads to make money. Watch cost per purchase
  and purchase value by country, not clicks.
- **Plan:** run 7 days before judging (Meta's learning phase). Pause a
  country whose cost per purchase stays above about 2× the order value.
  Shift budget toward the better country.
- **Levers if cost per purchase is close:** raise order value (bundle
  message, the add-ons), a second creative, and retargeting the people who
  started checkout.
- **Claims:** no earnings or "instant app" promises. The woman is a
  generated actor, so never present her as a customer. Check Meta's current
  AI-disclosure rules when launching.
