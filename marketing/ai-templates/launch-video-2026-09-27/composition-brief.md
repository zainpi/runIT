# Hyperframes Composition Brief: runsIT AI Templates

## Objective

Create a 24.8-second landscape product video advertising AI Templates to people without coding experience. Show the real store-to-dashboard-to-guide-to-prompt flow, then the optional extras. The copy should be exciting without promising a finished app from one paste.

## Output

- Composition: `marketing/ai-templates/launch-video-2026-09-27/composition/`
- Render: `marketing/ai-templates/launch-video-2026-09-27/brag.mp4`
- 1920 × 1080, 30 fps, no narration.

## Source material

- Project root: `/Users/Zain/Developer/runIT`
- Read `src/app/templates/store.tsx`, `src/app/templates/trial/dashboard.tsx`, `src/app/templates/library/ai-editor.tsx`, `src/app/templates/library/library.tsx`, `src/app/templates/library/build-guide.tsx`, `src/app/templates/library/build-file-map.tsx`, `src/app/templates/managed-launch.tsx`, `src/lib/templates/catalog.ts`, `src/app/templates/store.module.css`, `src/app/templates/templates.module.css`, `docs/ai-templates.md`.
- Product: runsIT AI Templates.
- Real UI: six template cards, selected state, Plan / Build files / Add-ons dashboard tabs, plan and AI chat columns, guide preview/download, prompt copy action.
- Verbatim product copy where displayed: “Your idea. A head start.”; “Copy full prompt”; “Download complete HTML guide”; “App icon”; “AI teamwork”; “Skills & tools setup”.
- Example project: “PlantLoop” is invented for the film and visibly labeled as an example.
- Research/claim notes: `../source-notes.md`.

## Creative direction

- Tone preset: `app-store`.
- Warm, beginner-friendly, precise and interface led.
- Hook: “Got an app idea? No coding experience?”
- Close: “Your idea. A head start.”
- Avoid abstract AI graphics, finished-app promises, live checkout claims, and an unqualified “one-shot builds everything” claim.

## Visual identity

- Background: `#ede4d3`; surface: `#fffdf7`; text: `#1b1a17`; accent: `#ff5a36`; selected extra: `#ffd23f`; muted text: `#5e594f`.
- Figtree 500/800 from `src/assets/fonts/` for body and display.
- Use 2–4px ink borders, rounded cream cards, orange active selection, compact source-based dashboard chrome, strong video-scale headlines.

## Storyboard

Use `../brag-plan.md` as the scene contract.

1. The idea, 0.0–2.8: hook and idea card.
2. Pick a template, 2.8–6.6: six real choices; select Mobile app.
3. Shape the plan, 6.6–11.4: source-based Plan/Chat dashboard with labeled example project and 20 edits.
4. Full guide, 11.4–16.7: complete HTML guide and sample prototype.
5. Full prompt and extras, 16.7–21.0: copy action and three real add-ons.
6. Brand close, 21.0–24.8: headline, runsIT name and URL, optional launch help line.

## Audio

- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`, quiet and upbeat, fade in/out. Cue metadata: `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`.
- Soft interface/impact SFX chosen after animation; reference `/Users/Zain/.agents/skills/brag/assets/sfx/sfx-analysis.md` and prefer low high-frequency risk.
- Optional subtle audio-reactive warmth/depth on an existing non-text background element. Do not add waveform visuals.
- Strong cue candidates: 17.02 and 21.01 seconds. Sequential windows: 3.02–5.03 and 17.52–19.52 seconds. Readability takes precedence.
- Voice disabled for this run.

## Hyperframes requirements

Use the current `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and `hyperframes-cli` contracts. The composition is owned by `/brag`, so do not enter the generic product-launch intent interview. Keep animation deterministic and seek-safe. Run `npx hyperframes check` with zero errors before rendering. Preserve all source-based claim boundaries documented in `../source-notes.md`.
