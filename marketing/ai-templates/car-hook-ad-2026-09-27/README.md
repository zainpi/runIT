# runsIT car-hook ad (30 s, 9:16)

Implements `complete-ad-prompt.txt`: an 8-second generated creator hook, then
the supplied 22-second product section (`runsit-product-section-9x16.mp4`,
used as-is), with off-screen narration, burned-in captions, ducked product
audio and a -14 LUFS mix.

| File | Purpose |
| --- | --- |
| `prompts/01-car-hook.txt` | Seedance prompt for SHOT 1 (on-camera dialogue) |
| `prompts/02-narration-a.txt` | Same woman, narration lines 1–3 (audio only is used) |
| `prompts/03-narration-b.txt` | Same woman, narration lines 4–5 (audio only is used) |
| `assemble.py` | Trims the hook, places narration on its beats, ducks the product audio 12 dB under speech, burns captions, normalises loudness, exports |
| `fonts/` | Inter Bold and Sora Bold (OFL), converted from `brag-output` for libass |

Higgsfield has no text-to-speech model, so the narration is generated with the
same Seedance character description and only its audio is kept. The 44
narration words do not fit comfortably in one 15-second take, so they are split
across two. Listen for voice consistency with the hook before publishing. If the
voices differ noticeably, record the five lines (or use one voice for all of
them) and pass that file to `--narration` instead.

## Generate (Higgsfield, paid)

Rough cost from the account's token pricing: hook 9 s at 1080p ≈ $6.12,
narration 12 s + 9 s at 480p ≈ $2.83. Run from the repository root:

```sh
npm run higgsfield -- submit --prompt "$(cat marketing/ai-templates/car-hook-ad-2026-09-27/prompts/01-car-hook.txt)" --duration 9 --resolution 1080p --aspect 9:16 --audio true
npm run higgsfield -- submit --prompt "$(cat marketing/ai-templates/car-hook-ad-2026-09-27/prompts/02-narration-a.txt)" --duration 12 --resolution 480p --aspect 9:16 --audio true
npm run higgsfield -- submit --prompt "$(cat marketing/ai-templates/car-hook-ad-2026-09-27/prompts/03-narration-b.txt)" --duration 9 --resolution 480p --aspect 9:16 --audio true
npm run higgsfield -- wait --job <job-id>        # for each job
npm run higgsfield -- download --job <job-id>    # saves to .higgsfield/output/<job-id>.mp4
```

The hook is generated at 9 s so only its trailing pause is trimmed to 8.00 s.
Review the hook for hands, lip sync and stray on-screen text before assembly.

## Assemble

Needs ffmpeg with libass (`pip install imageio-ffmpeg` provides one).

```sh
python3 marketing/ai-templates/car-hook-ad-2026-09-27/assemble.py \
  --hook .higgsfield/output/<hook-job>.mp4 \
  --narration .higgsfield/output/<narration-a-job>.mp4 .higgsfield/output/<narration-b-job>.mp4
```

Outputs land in `out/` (ignored): `runsit-car-hook.mp4`,
`runsit-complete-ad-30s.mp4` (H.264 High, 1080x1920, constant 30 fps,
yuv420p, ~14 Mbps, AAC 48 kHz stereo, fast start), `runsit-complete-ad-30s.srt`,
plus `captions.ass`, `timings.json` and `report.json` (loudness and placements).

- The script refuses a non-9:16 hook (no center-crop) and a hook whose words run past 8.00 s.
- Narration lines are found by silence detection. If it does not find exactly
  five, pass `--narration-cuts cuts.json` with `[{"file": "...", "start": 0.4, "end": 3.1}, ...]`
  in script order.
- Caption timings follow the detected speech. Check `runsit-complete-ad-30s.srt` against the audio.
- `--preview` renders a placeholder hook with planned timings to check caption layout.

Caption placement: the hook headline sits above lower-third dialogue captions;
product captions sit at y≈1690–1755, x≈325–664, clear of product headings,
example/sample labels, guide controls and the end-card URL. One word per chunk
is highlighted in yellow.

## Handoff (separate steps, not done here)

- CTA button: Find your template → https://runsit.ca/templates/
- Primary text: "Too many app ideas. No idea where to start? Pick an AI template, shape your plan, and get a clear starting point for your build."
- Headline: "Give your app idea a starting point."
- Website: place near the template introduction with the same CTA beneath, a poster frame, captions and user-initiated sound.
