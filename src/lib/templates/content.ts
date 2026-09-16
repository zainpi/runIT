import "server-only";
import type { TemplateId } from "./catalog";
import { discordBotPrompt } from "./prompts/discord-bot";
import { robloxGamePrompt } from "./prompts/roblox-game";
import { mobileGamePrompt } from "./prompts/mobile-game";
import { mobileAppPrompt } from "./prompts/mobile-app";
import { storefrontPrompt } from "./prompts/storefront";
import { browserGamePrompt } from "./prompts/browser-game";
export const templateFoundations: Record<TemplateId, string> = {
  "discord-bot": discordBotPrompt, "roblox-game": robloxGamePrompt,
  "mobile-game": mobileGamePrompt, "mobile-app": mobileAppPrompt,
  storefront: storefrontPrompt, "browser-game": browserGamePrompt,
};
