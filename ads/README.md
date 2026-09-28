# runsIT video ads

Vertical (1080×1920, 30 fps) TikTok ads for [runsit.ca/templates](https://runsit.ca/templates),
built from three kinds of material:

1. **Generated real-life clips** from Higgsfield (Seedance 2.5 video plus a
   Marketing Studio keyframe), created by a budget-guarded job runner.
2. **Real product footage**: the templates store and workspace recorded on a
   phone-sized viewport with synthetic API responses.
3. **Motion graphics** composed in [Remotion](https://www.remotion.dev/) (React).

This is a separate npm package. It doesn't touch the Next.js app, and the
root `tsconfig.json` excludes `ads/`.

```
ads/
  campaigns/<id>/shots.json      Higgsfield jobs + budget (edit this)
  campaigns/<id>/manifest.json   every paid submission, written by the runner (commit it)
  campaigns/<id>/CONCEPT.md      script, caption, hashtags, posting checklist
  lib/higgsfield-jobs.mjs        estimate / submit / poll / download, with tests
  scripts/clips.mjs              CLI for the job runner
  scripts/record-product.mts     product screen recorder (Playwright)
  scripts/make-music.py          original synthesized music bed (numpy)
  scripts/make-voiceover.py      voiceover lines via Kokoro-82M TTS (offline)
  src/                           Remotion project (NotesAppIdeas composition)
  public/campaigns/<id>/         downloaded keyframes/clips (paid; commit them)
  public/footage/                product recordings + marks.json (tap timestamps)
  public/voiceover/              one WAV per line + vo.json (start, duration, word timings)
  public/fonts, public/sfx       Sora/Inter, Kenney CC0 sound effects
  out/                           renders (git-ignored)
```

## Setup

```sh
cd ads && npm ci          # Remotion 4.0.528, React 18.3.1
npm test                  # job-runner tests (no network)
```

The footage recorder also needs the root install: run `npm ci` at the repo root.

## 1. Generated clips (Higgsfield)

Credentials come from `HF_API_KEY_ID` + `HF_API_KEY_SECRET` (repo-root
`.env.higgsfield.local` or `ads/.env.local`, both git-ignored), or from a cloud
environment API credential for `api.higgsfield.ai` (header `Authorization`,
prefix `Key`, value `id:secret`). With neither variable set, no Authorization
header is sent, so the environment proxy can add it. Never commit or print keys.

```sh
npm run clips:check                            # free: /estimate only; prints cost per job, blocks over budget
npm run clips:generate -- --only hero          # one job first (the keyframe costs cents)
npm run clips:generate -- --regenerate hero    # deliberately pay for a new take
npm run clips:generate                         # the rest (~$7 for notes-app-ideas)
npm run clips:generate -- --fallback hook      # use a job's text-to-video fallback
```

- Each job is submitted at most once. The manifest records `submitting`
  before the POST, so a crash never leads to a silent second charge. An
  uncertain submission stops the run: check the Higgsfield dashboard, then set
  its manifest status to `rejected` (not charged) or add its `request_id`.
- Image-to-video jobs get the keyframe's hosted URL (`fromImage`).
- Results download to `public/campaigns/<id>/{keyframes,clips}/`. If the
  download host (a CDN) is blocked by the network allowlist, add that host.
- In cloud containers, Node's `fetch` needs `NODE_USE_ENV_PROXY=1` (the npm
  scripts set it). Without it the proxy answers `403 host_not_allowed`.
- Pricing (2026-09): Seedance 2.5 is token-metered. 5 s at 720p 9:16 costs
  about $2.31. The API has no 1080p output; Remotion upscales the 720p clips
  inside the 1080×1920 frame.

After a generate, commit `campaigns/<id>/manifest.json` and
`public/campaigns/<id>/**`.

## 2. Product footage

```sh
AD_CHROMIUM=/opt/pw-browsers/chromium npm run footage
```

This starts `next dev` on port 3102 (or reuses a server already running
there) and mocks `/api/templates/*` with a synthetic "BoulderMe" climbing-app
plan. The guide comes from `tests/templates/fixtures/build-guide.json`. No
purchase, trial code or AI provider is used. It writes
`public/footage/{store,describe,plan,guide}.mp4` (1170×2532) and `marks.json`.

The pages run in 4× slow motion while full-resolution screenshots are taken,
then the frames are retimed to real speed. `AD_SLOWMO` changes the factor.
In-page animation code must use `performance.now()`, not rAF timestamps,
because the slowed animation clock also drives rAF.

## 3. Voiceover

```sh
pip install kokoro-onnx soundfile numpy
npm run voiceover                     # or: python3 scripts/make-voiceover.py --voice af_heart --speed 1.15
```

This uses [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0,
so commercial use is fine), running offline on the CPU. The first run
downloads about 350 MB of model files to `~/.cache/runsit-ads/kokoro`. The
lines, their start times in the edit and the spoken spelling ("Runs it") are
in `LINES` at the top of the script. It prints each line's end time and warns
when two lines overlap. Captions in the hook are timed from `vo.json`.
Higgsfield has no text-to-speech model, and separate Seedance takes would
each give her a different voice. So the clips carry no dialogue, and this
one voice narrates the whole ad.

To audition voices, rerun with `--voice` (`af_heart`, `af_bella`, `af_aoede`,
`af_kore`, `af_sarah`, `af_nicole`, …) and re-render.

## 4. Compose and render

```sh
npm run studio                      # live preview
npm run music                       # optional: regenerate public/music/idea-pulse.wav
export REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell   # cloud container only
npm run render:all                  # out/notes-app-ideas.mp4, out/notes-app-ideas-no-music.mp4, out/poster.png
npm run typecheck
```

- Any clip missing from `public/` renders as a styled placeholder, so the edit
  works before the paid clips exist. Rerender once they are downloaded.
- Timing that depends on a generated take is in `src/timing.ts`: the hook
  offset, the montage cut points, and the payoff trim/speed. Scene boundaries
  are in `src/brand.ts`. Voiceover placement comes from
  `public/voiceover/vo.json`.
- Props: `music` (default true) and `voiceover` (default true).
- Product segments are fitted from `public/footage/marks.json`, so after
  re-recording the step captions and tap sounds stay in sync automatically.
- `--props='{"music":false}'` drops the music bed. Use the no-music render
  for TikTok business accounts, which must add a Commercial Music Library
  sound in the app.
- Text stays inside TikTok's safe zone: clear of the top 8%, the bottom 20%
  and the right 15% (`safe` in `src/brand.ts`).
- In cloud containers, the bundled ffmpeg (`npx remotion ffmpeg`) has no `fps`,
  `select` or `tile` filters. Use `-r 30` and `-ss` seeks instead.

## Licensing notes

- Remotion is free for individuals and companies with 3 or fewer employees.
  Larger companies need a [company license](https://www.remotion.pro/license).
- Sound effects are Kenney CC0. The music bed is synthesized by
  `make-music.py` (original, no samples). The voiceover is Kokoro-82M
  (Apache-2.0).
- Generated people are actors in a skit, not customers. Don't present them as
  testimonials. Turn on TikTok's "AI-generated content" label when posting.
