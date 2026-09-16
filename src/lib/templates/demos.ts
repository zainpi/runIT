import type { TemplateId } from "./catalog";

// Public examples stay separate from the generic, downloadable prompt content.
export const templateDemos: Record<TemplateId, readonly { name: string; url: string }[]> = {
  "discord-bot": [],
  "roblox-game": [{ name: "Build Your Room", url: "https://www.roblox.com/games/95318676575728/Build-Your-Room" }],
  "mobile-game": [{ name: "The Last Echo", url: "https://runsit.ca/the-last-echo/" }],
  "mobile-app": [{ name: "PulseDeals", url: "https://runsit.ca/pulsedeals/" }],
  storefront: [{ name: "Baked@Night", url: "https://baked-at-night.pages.dev/" }],
  "browser-game": [{ name: "Local Lore", url: "https://runsit.ca/local-lore/" }],
};
