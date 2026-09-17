export const templateCatalog = [
  { id: "discord-bot", title: "Discord bot", category: "Advanced automation & AI", symbol: "bot", description: "Build an advanced bot with custom commands, automated workflows, optional AI responses, and the data sources you need. Simple, step-by-step instructions take you from setup to running it yourself.", includes: ["Custom commands & multi-server permissions", "Scheduled workflows & reliable alerts", "Optional AI responses, summaries & scoring", "Connections to APIs, databases, spreadsheets & files", "Step-by-step setup with service URLs", "Hosting, monitoring & recovery"], stack: "Python · Discord · Data sources · AI", color: "violet" },
  { id: "roblox-game", title: "Roblox game", category: "Create & play", symbol: "blocks", description: "Build a Roblox game around your own core loop, with secure multiplayer, reliable saves, and optional progression.", includes: ["Building & placement", "Inventory & progression", "Multiplayer & safe saves", "Optional Robux purchases"], stack: "Luau · Roblox Studio · DataStore", color: "blue" },
  { id: "mobile-game", title: "Mobile game", category: "A world in your pocket", symbol: "game", description: "Build a game players can return to. Adapt the core loop, controls, progression, and optional live features to your idea.", includes: ["Game loop & content systems", "Optional accounts & cloud saves", "Optional purchases & ads", "iOS & Android release"], stack: "Godot · GDScript · Supabase", color: "peach" },
  { id: "mobile-app", title: "Mobile app", category: "Everyday utility", symbol: "phone", description: "Bring your idea to life with native screens, workflows and data shaped around your users, plus optional accounts and integrations.", includes: ["Native screens & offline state", "Optional accounts & subscriptions", "Workflows tailored to your idea", "Backend & App Store setup"], stack: "SwiftUI · Cloudflare · Supabase", color: "mint" },
  { id: "storefront", title: "Online store", category: "Make it. Sell it.", symbol: "shop", description: "Your own storefront, from the product catalog and shopping cart to payment and order fulfillment.", includes: ["Catalog & shopping cart", "Stripe Checkout", "Orders & fulfillment", "Domain, hosting & operations"], stack: "HTML/CSS/JS · Cloudflare · Stripe", color: "pink" },
  { id: "browser-game", title: "Browser game", category: "Just open & play", symbol: "globe", description: "Build a browser game around your idea, with responsive controls, reliable state and optional maps or daily challenges.", includes: ["Game rounds & daily challenges", "Optional maps & street imagery", "Server-verified scoring", "Usage limits & deployment"], stack: "JavaScript · Cloudflare · Maps", color: "lime" },
] as const;

export type TemplateId = (typeof templateCatalog)[number]["id"];
export type BuildMode = "computer" | "manual";
export const FIRST_TEMPLATE_CENTS = 999;
export const EXTRA_TEMPLATE_CENTS = 500;
export const SUBAGENT_ADDON_CENTS = 500;
export const SKILL_TREE_ADDON_CENTS = 1000;
export type TemplateCurrency = "cad" | "usd";
export const DEFAULT_TEMPLATE_CURRENCY: TemplateCurrency = "cad";
export const TEMPLATE_VERSION = "2026-09-16";

export function templateCurrencyForHostname(hostname: string): TemplateCurrency {
  return ["runs-it.com", "www.runs-it.com"].includes(hostname.toLowerCase()) ? "usd" : DEFAULT_TEMPLATE_CURRENCY;
}

export function bundlePrice(count: number, subagents = false, skillTree = false): number {
  if (!Number.isInteger(count) || count < 0 || count > templateCatalog.length) throw new Error("Invalid template count.");
  return count === 0 ? 0 : FIRST_TEMPLATE_CENTS + (count - 1) * EXTRA_TEMPLATE_CENTS + (subagents ? SUBAGENT_ADDON_CENTS : 0) + (skillTree ? SKILL_TREE_ADDON_CENTS : 0);
}

export function formatPrice(cents: number, currency: TemplateCurrency = DEFAULT_TEMPLATE_CURRENCY): string {
  return new Intl.NumberFormat(currency === "cad" ? "en-CA" : "en-US", { style: "currency", currency: currency.toUpperCase(), currencyDisplay: "narrowSymbol" }).format(cents / 100);
}

export function parseTemplateIds(value: unknown): TemplateId[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > templateCatalog.length || new Set(value).size !== value.length || value.some((id) => !templateCatalog.some((item) => item.id === id))) {
    throw new Error("Choose between one and six different templates.");
  }
  return templateCatalog.filter((item) => value.includes(item.id)).map((item) => item.id);
}
