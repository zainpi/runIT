import { products, founders } from "@/lib/company";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { templateDemos } from "@/lib/templates/demos";

type ProductId = (typeof products)[number]["id"];

// Desktop presentation for each product: icon, window artwork and title-bar colour.
const appVisuals: Record<ProductId, { file: string; icon: string; image: string; imageAlt: string; width: number; height: number; background: string; tone: string }> = {
  pulsedeals: { file: "PulseDeals.app", icon: "/products/pulsedeals-artwork.webp", image: "/products/pulsedeals-artwork.webp", imageAlt: "PulseDeals artwork: a phone showing deals beside a price tag", width: 1536, height: 1024, background: "#43281a", tone: "#ffb27a" },
  "the-last-echo": { file: "TheLastEcho.app", icon: "/the-last-echo/img/app-icon.png", image: "/the-last-echo/screenshots/battle.png", imageAlt: "The Last Echo battle screen: a knight fights an orc in a pixel-art forest", width: 1280, height: 720, background: "#2a1633", tone: "#a6db86" },
  "local-lore": { file: "LocalLore.app", icon: "/products/local-lore-artwork.webp", image: "/products/local-lore-artwork.webp", imageAlt: "Local Lore artwork: a folded map with a pin", width: 1536, height: 1024, background: "#1f3d31", tone: "#dcf76a" },
  "build-your-room": { file: "BuildYourRoom.app", icon: "/products/build-your-room-artwork.jpg", image: "/products/build-your-room-artwork.jpg", imageAlt: "Build Your Room key art: a Roblox character in a decorated bedroom", width: 1920, height: 1080, background: "#123443", tone: "#7fd8ff" },
  neutronium: { file: "Neutronium.app", icon: "/products/neutronium-artwork.webp", image: "/products/neutronium-artwork.webp", imageAlt: "Neutronium artwork: a laptop linked to employee cards and a security shield", width: 1536, height: 1024, background: "#1d2b55", tone: "#b8c6ff" },
};

export const templateTones: Record<(typeof templateCatalog)[number]["color"], string> = {
  violet: "#c3b1ff",
  blue: "#7fb2ff",
  peach: "#ffb38a",
  mint: "#7fd8c3",
  pink: "#ff9fc8",
  lime: "#cfef6a",
};

export type DesktopApp = (typeof products)[number] & (typeof appVisuals)[ProductId] & { template?: { id: TemplateId; title: string } };

export const desktopApps: DesktopApp[] = products.map((product) => {
  const template = templateCatalog.find((item) => templateDemos[item.id].some((demo) => demo.name === product.name));
  return { ...product, ...appVisuals[product.id], template: template && { id: template.id, title: template.title } };
});

export const templateFiles = templateCatalog.map((template) => ({
  id: template.id,
  file: `${template.id === "storefront" ? "online-store" : template.id}.prompt`,
  title: template.title,
  category: template.category,
  description: template.description,
  tone: templateTones[template.color],
  demos: templateDemos[template.id],
}));

const founderTones = ["#ff8a6b", "#7fd8c3", "#c3b1ff"];

export const founderCards = founders.map((founder, index) => ({
  ...founder,
  initials: founder.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(""),
  tone: founderTones[index % founderTones.length],
}));
