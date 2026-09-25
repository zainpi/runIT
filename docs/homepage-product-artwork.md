# Homepage product artwork

## Homepage video

The homepage intro embeds `public/videos/runsit-intro.mp4`, copied unchanged
from the user-selected `composition_2026-09-16_19-54-09.mp4` export. It is a
22-second, 1920 × 1080 H.264/AAC video (4,809,123 bytes). The poster at
`public/videos/runsit-intro-poster.jpg` is extracted from 1.7 seconds into that
same video. The player uses native controls, inline playback and `preload="none"`;
it does not autoplay. A text description covers the visual sequence and notes
that the audio is music and interface sounds without narration.

To replace it, update those two files in `public/videos/` and keep the page’s
duration and text description in sync. The source composition stays under
`brag-output/`; only the finished video and poster are served by the homepage.

## Product images

Replaced on 25 September 2026 with compositions of each product's real interface, so the cards show the apps rather than abstract illustrations. Each is a 1600 × 800 WebP (quality 80) drawn on its card colour, so the edges blend into the artwork frame. The homepage reads the path, size and alt text from `products` in `src/lib/company.ts`.

| Product | Asset | Source material |
| --- | --- | --- |
| PulseDeals | `public/products/pulsedeals-preview.webp` | Raw App Store previews from the PulseDeals repository (`docs/store_assets/previews/raw/`: alerts, feed, detail) in iPhone frames on `#352318`. The in-app deals are the app’s own “Sample deal” examples. |
| The Last Echo | `public/products/the-last-echo-preview.webp` | Gameplay screenshots `public/the-last-echo/screenshots/new/03-early-battle.png` and `04-late-boss-battle.png` in landscape phone frames over the game’s `forest_bg.png` on `#0d1f1a`. |
| Local Lore | `public/products/local-lore-preview.webp` | The live Local Lore page captured at 1440 × 900 and 390 × 844 in a result state, with API responses mocked the same way as `tests/local-lore/layout.spec.ts`. Real Street View and Google map images are not used: the photo and map are illustrated stand-ins, and their Google attribution captions were hidden for the capture. |
| Neutronium | `public/products/neutronium-preview.webp` | The Neutronium development workspace (`npm run dev`, Acme Inc. sample data) captured at 1440 × 900 with the development badge, sandbox bar and workspace note hidden. The floating panel is an enlarged crop of the same screen’s access request. |
| Build Your Room | `public/products/build-your-room-artwork.webp` | Unchanged promotional illustration, originally `Build_Your_Room/assets/listing/v1/upload/game_thumbnail.jpg`, re-encoded from the 1920 × 1080 JPEG (765 KB) to a 1280 × 720 WebP (135 KB). It is an illustration, not a gameplay screenshot. |

To refresh a card, capture the product at 2× device scale, place the screenshots in device or browser frames in an HTML scene sized 1600 × 800 with the card colour as the background, screenshot it with Chromium, and encode it with `sharp(...).webp({ quality: 80 })`. Use a new filename so cached copies are not reused, and update the alt text in `company.ts` to describe what the image shows.
