# runsIT launch video

22 seconds · landscape 1920 × 1080 · 30 fps · music and subtle SFX · no narration.

The film moves from real runsIT product artwork into a source-based reconstruction of template selection and personalization. City Quest is synthetic example content. The template flow is condensed; no purchase or external account was used.

## Files
- `brag.mp4`: finished H.264/AAC video with the selected poster replacing frame zero.
- `brag.jpg`: settled hook at 1.7s, showing the exact invitation and all five products.
- `watch.html`: local player with download links.
- `share-copy.txt`: single ready-to-post caption.
- `brag-plan.md` and `composition-brief.md`: creative plan and source references.
- `composition/`: editable Hyperframes project, local fonts, artwork, audio and runtime.
- `check-report.json`, `keyframes-report.txt`, `verification.json`: validation evidence.

## Editing and rendering
The source generator `build-composition.py` produces `composition/index.html`, `frame.md`, and the motion assertions. Edit the generator if rebuilding; direct HTML edits are fine but will be overwritten by the generator.

```sh
python3 build-composition.py
cd composition
npm run check
npx --yes hyperframes@0.8.44 preview --background --port 3017
npx --yes hyperframes@0.8.44 render --quality delivery --fps 30 --workers 1 --low-memory-mode --output ../brag.raw.mp4
```

After rendering, run `python3 ../finish-video.py` from the composition directory. It extracts the chosen poster at 1.7 seconds, replaces only frame zero, and checks resolution, duration, frame count and audio. The supplied final video already has this treatment.

## Sources
Project product artwork and UI copy: the local runsIT source named in `composition-brief.md`.
Fonts: Sora and Inter, downloaded from Google Fonts with CSS provenance alongside the font files.
Runtime and text-stagger entrance recipe: Hyperframes 0.8.44 / HeyGen, GSAP 3.14.2.
Music: Happy Beats / Business Moves vol. 12 by ende.app, from the brag skill bundle.
SFX: Kenney CC0 assets from the brag skill bundle.

Only the `brag-output/` directory was authored for this task. No website deployment was performed.

## Validation notes
Hyperframes check passed with zero errors across lint, runtime, layout, motion and contrast. Two static warnings concern intentional reuse of the same artwork across different timed scenes; rendered snapshots confirmed those instances display correctly. The two informational layout findings describe the intentional slight image zoom inside its clipped frame.
