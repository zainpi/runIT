# runsIT car-hook ad (30 s, 9:16)

Implements `complete-ad-prompt.txt`: an 8-second generated creator hook, then
the supplied 22-second product section (`runsit-product-section-9x16.mp4`,
used as-is), with off-screen narration, burned-in captions, ducked product
audio and a -14 LUFS mix.

## Delivered (2026-09-27)

| File | Result |
| --- | --- |
| `deliverables/runsit-complete-ad-30s.mp4` | 30.00 s, 1080x1920, constant 30 fps, H.264 High, yuv420p, AAC 48 kHz stereo, fast start; -14.2 LUFS integrated, -1.4 dBTP |
| `deliverables/runsit-car-hook.mp4` | 8.00 s opening; all words kept |
| `deliverables/runsit-complete-ad-30s.srt` | Captions matching the burned-in chunks |
| `deliverables/assembly-report.json` | Narration placements and loudness |
| `generated/*-raw.mp4` | Untouched Seedance outputs, for re-assembly |

Checks: a speech-to-text pass on the final mix recovered every scripted line
("runs it dot C A" transcribes as "runsit.ca"). The hook's last word ended at
8.24 s, so 0.33 s of silence before her first word was trimmed as well as the
trailing pause. Median voice pitch is 205 Hz (hook) vs 191 and 200 Hz
(narration takes); listen to confirm the voices match.

Video averages about 8.5 Mbps (two-pass, 14 Mbps target). The hook section runs
at about 22 Mbps. The supplied product section is about 1 Mbps and saturates at
about 2.3 Mbps even near lossless, so 12–20 Mbps could only be reached with filler.

Review before posting: the generated top shows more cleavage and midriff than
"subtle", and the framing is wider than face and upper torso. Check it against
each ad platform's policy on suggestive imagery, or regenerate the hook with a
more modest top.

## Files

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

## Editable product section

- `runsit-product-section-9x16.mp4`: 22-second portrait product section, including music, UI sound effects, and the CTA. The assembly uses it from 8–30 seconds at normal speed with its existing end card.
- `complete-ad-prompt.txt`: complete Higgsfield hook prompt plus exact edit timeline, matching narration, captions, audio mixing, export settings, and website/ad handoff.
- `runsit-portrait-master.mp4`: 24.8-second portrait adaptation of the original brag composition, including its original text opening.
- `composition/`: editable HyperFrames source. The original landscape project is unchanged.

The product-section MP4 does not include the generated car footage or the new narration; the final deliverables combine them.

Derived from `../launch-video-2026-09-27/composition/`. Reflowed to 1080 × 1920; source text opening is removed at export (master in-point 2.8 seconds). The portrait composition uses HyperFrames 0.8.80, upgraded from the source project's 0.8.79. All assets are local.

Product-section checks: HyperFrames runtime, layout, and contrast checks passed. Seven inherited composition-structure advisories remain; no lint errors. Visual frames were reviewed for all product scenes. MP4 properties and decode are recorded in `export-verification.json`.

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
yuv420p, two-pass 14 Mbps target, AAC 48 kHz stereo, fast start), `runsit-complete-ad-30s.srt`,
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
