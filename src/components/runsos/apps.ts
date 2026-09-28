import { products, founders } from "@/lib/company";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { templateDemos } from "@/lib/templates/demos";

type ProductId = (typeof products)[number]["id"];

// Desktop presentation for each product: icon, title-bar colour and file name. The window
// artwork, its size and alt text come from each product's shared artwork in company.ts.
const appVisuals: Record<ProductId, { file: string; icon: string; background: string; tone: string }> = {
  pulsedeals: { file: "PulseDeals.app", icon: "/products/pulsedeals-icon.webp", background: "#43281a", tone: "#ffb27a" },
  "the-last-echo": { file: "TheLastEcho.app", icon: "/the-last-echo/img/app-icon.png", background: "#2a1633", tone: "#a6db86" },
  "local-lore": { file: "LocalLore.app", icon: "/products/local-lore-icon.webp", background: "#1f3d31", tone: "#dcf76a" },
  "build-your-room": { file: "BuildYourRoom.app", icon: "/products/build-your-room-icon.webp", background: "#123443", tone: "#7fd8ff" },
  neutronium: { file: "Neutronium.app", icon: "/products/neutronium-icon.webp", background: "#1d2b55", tone: "#b8c6ff" },
};

export const templateTones: Record<(typeof templateCatalog)[number]["color"], string> = {
  violet: "#c3b1ff",
  blue: "#7fb2ff",
  peach: "#ffb38a",
  mint: "#7fd8c3",
  pink: "#ff9fc8",
  lime: "#cfef6a",
};

export type DesktopApp = (typeof products)[number] & (typeof appVisuals)[ProductId] & {
  image: string; imageAlt: string; width: number; height: number;
  template?: { id: TemplateId; title: string };
};

export const desktopApps: DesktopApp[] = products.map((product) => {
  const template = templateCatalog.find((item) => templateDemos[item.id].some((demo) => demo.name === product.name));
  const { src, alt, width, height } = product.artwork;
  return { ...product, ...appVisuals[product.id], image: src, imageAlt: alt, width, height, template: template && { id: template.id, title: template.title } };
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
