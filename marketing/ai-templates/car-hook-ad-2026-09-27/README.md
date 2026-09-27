# runsIT car-hook ad package

- `runsit-product-section-9x16.mp4`: 22-second portrait product section, including music, UI sound effects, and the CTA. Append after an 8-second generated hook.
- `complete-ad-prompt.txt`: complete Higgsfield hook prompt plus exact edit timeline, matching narration, captions, audio mixing, export settings, and website/ad handoff.
- `runsit-portrait-master.mp4`: 24.8-second portrait adaptation of the original brag composition, including its original text opening.
- `composition/`: editable HyperFrames source. The original landscape project is unchanged.

The product-section MP4 does not include the generated car footage or the new narration. Those are specified in the prompt for Higgsfield and the editor.

Final assembly: hook from 0–8 seconds; product section from 8–30 seconds. Keep the product section at normal speed and use its existing end card.

Derived from `../launch-video-2026-09-27/composition/`. Reflowed to 1080 × 1920; source text opening is removed at export (master in-point 2.8 seconds). The portrait composition uses HyperFrames 0.8.80, upgraded from the source project’s 0.8.79. All assets are local.

Checks: HyperFrames runtime, layout, and contrast checks passed. Seven inherited composition-structure advisories remain; no lint errors. Visual frames were reviewed for all product scenes. MP4 properties and decode are recorded in `export-verification.json`.
