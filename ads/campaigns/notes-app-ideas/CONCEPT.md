# Notes-app idea graveyard

A 21.4 s, 9:16 TikTok ad for [runsit.ca/templates](https://runsit.ca/templates).
Composition: `NotesAppIdeas` (`ads/src/NotesAppIdeas.tsx`).

**Angle:** everyone has a notes app full of app ideas that never got built.
runsIT templates turn one of those ideas into a plan, a step-by-step build
guide with a clickable prototype, and prompts for the buyer's own AI coding
tool. We sell the head start. We don't promise a finished or instant app.

## Script

| Time | Picture | On-screen text | Audio |
|---|---|---|---|
| 0–3.4 s | **Hook clip** (generated): she talks to camera at her desk at night | Top: "my notes app is an **app-idea graveyard**" · word-by-word captions | Her line: *"Every app idea I've ever had is still in my notes app."* |
| 3.4–5.8 s | iOS Notes-style card "app ideas 💡" over a blurred freeze frame. Six items pop in with ticks, one per template: climbing buddy app · grandma's hot sauce store · roblox obby w/ friends · discord sneaker-drop bot · boba shop idle game · daily guess-my-city game | Stamp: **0 built** | Whoosh, a pop per tick, stamp impact |
| 5.8–8.4 s | **Montage clip** (generated), three hard cuts: hot-sauce maker, teen gamer, climber | "everyone's sitting on **one.**" | Room sound from the clip |
| 8.4–9.6 s | Kinetic type on the brand background | "what if it came with the **build plan?**" | Whoosh, riser |
| 9.6–16.2 s | Real product footage in a phone frame | 1. pick a template → 2. describe your idea → "AI is planning…" → 3. AI turns it into a real plan → 4. step-by-step guide + clickable prototype | Taps synced to `marks.json`, music drop |
| 16.2–18.4 s | **Payoff clip** (generated): she types, then throws her hands up | "paste it into your AI coder…" → "…and **actually build it.**" | Keyboard, laugh |
| 18.4–21.4 s | End card | runsIT. · AI build templates · from $9.99 · "Your idea. A head start." · 6 template chips · **runsit.ca/templates →** · link in bio | Impact |

Product facts used: 6 templates (Discord bot, Roblox game, Mobile game, Mobile
app, Online store, Browser game). **From $9.99** for the first template, $5
for each extra (CAD on runsit.ca, USD on runs-it.com, hence "from"). Every
order includes an AI plan, 20 edits, the guide/prototype and downloadable
prompts.

## Post caption

> every app idea I've ever had is still in my notes app 🪦💡 so I picked one and got the actual build plan: step-by-step guide, clickable prototype and prompts for my AI coder. from $9.99 → runsit.ca/templates (link in bio)

Hashtags: `#vibecoding #appidea #buildinpublic #aitools #techtok #indiedev #sidehustleideas #nocode`

Alternative on-screen hook for an A/B test: "POV: your notes app is where app ideas go to die".

## Posting checklist

- [ ] Final clips generated and reviewed: face consistent between hook and
      payoff, no garbled text or extra fingers, her line is audible and matches
      the captions (re-time `HOOK_WORDS` in `src/timing.ts`).
- [ ] Rendered `out/notes-app-ideas.mp4` (music) and
      `out/notes-app-ideas-no-music.mp4`. Watched it end to end on a phone
      with sound on and off.
- [ ] **Business account:** upload the no-music version and add a
      Commercial Music Library sound in the TikTok app. Personal/creator
      account: the version with the original music bed is fine.
- [ ] Turn on TikTok's **"AI-generated content"** label (the woman and
      the montage people are generated actors).
- [ ] Cover image: `out/poster.png` (the "0 built" Notes card), or pick a
      frame in the app.
- [ ] Link in bio points to `https://runsit.ca/templates` (add UTM
      parameters if you track them, e.g. `?utm_source=tiktok&utm_campaign=notes-app-ideas`).
- [ ] Check the price on the live site is still "from $9.99" before posting.
- [ ] Caption and comments make no testimonial or earnings claims, and no
      "instant app" or "finished app" promises. The templates are plans and
      prompts; building happens in the buyer's own AI coding tool.
- [ ] If boosting with Promote/Spark Ads, recheck the ad policy for
      AI-generated people and label disclosure.

## Guardrails

- The generated woman is an actor in a skit, not a customer. Never caption
  her as a user or reviewer.
- No claims about money earned, users gained or apps shipped.
- "from $9.99" only. Don't show a currency, since it differs by site.
