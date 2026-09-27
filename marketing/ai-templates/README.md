# runsIT AI Templates marketing

This folder holds campaign assets and ad-making tools for [runsIT AI Templates](https://runsit.ca/templates/).

## Campaign assets

- [Launch video](launch-video-2026-09-27/brag.mp4) (24.8 seconds) and [poster](launch-video-2026-09-27/brag.jpg)
- [Ready-to-post caption](launch-video-2026-09-27/share-copy.txt)
- [Storyboard and editable Hyperframes source](launch-video-2026-09-27/README.md)
- [Storefront, dashboard, guide, and add-on research](launch-video-2026-09-27/source-notes.md)
- [Social preview image](assets/social-preview.png)
- [Higgsfield ad tool and setup](higgsfield/README.md)

## Source of truth

Use the current application code and product documentation before publishing new claims: `src/app/templates/`, `src/lib/templates/`, and `docs/ai-templates.md`. The published copy of the social preview remains at `public/social/templates.png` because `src/lib/social.ts` serves it at `/social/templates.png`; copy any approved update there. The older site-wide homepage intro source remains in `brag-output/` and is documented in `docs/homepage-product-artwork.md`.

The template output is a plan, complete guide with a sample prototype, and a prompt for a separate coding AI. It does not promise a finished app from one paste. The optional launch service is quoted separately. Check current price, availability, and checkout state before adding them to campaign copy.
