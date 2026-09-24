export const products = [
  {
    id: "pulsedeals",
    name: "PulseDeals",
    category: "Shopping & discovery",
    description:
      "A live feed of price drops worth moving on. Discover deals across the marketplaces you shop.",
    href: "/pulsedeals/",
    action: "Explore PulseDeals",
    artwork: "/products/pulsedeals-artwork.webp",
  },
  {
    id: "the-last-echo",
    name: "The Last Echo",
    category: "Mobile gaming",
    description:
      "An idle RPG with a world to explore. Build your hero, discover new gear, and keep progressing while you’re away.",
    href: "/the-last-echo/",
    action: "Explore The Last Echo",
  },
  {
    id: "local-lore",
    name: "Local Lore",
    category: "Browser game · Toronto",
    description:
      "Explore Toronto, New York City, Vancouver and London through real Street View photos. Drop a map pin and build your local knowledge across three-round games.",
    href: "/local-lore/",
    action: "Play Local Lore",
    artwork: "/products/local-lore-artwork.webp",
  },
  {
    id: "build-your-room",
    name: "Build Your Room",
    category: "Roblox game",
    description:
      "Build a bedroom that feels like you. Collect furniture, explore creative dreams, and visit your friends’ rooms on Roblox.",
    href: "https://www.roblox.com/games/95318676575728/Build-Your-Room",
    action: "Play on Roblox",
    artwork: "/products/build-your-room-artwork.jpg",
  },
  {
    id: "neutronium",
    name: "Neutronium",
    category: "Business software",
    description:
      "A simpler workspace for company IT. Manage onboarding, employee access, and offboarding in one place.",
    href: "https://neutronium.runsit.ca/neutronium/",
    action: "Explore Neutronium",
    artwork: "/products/neutronium-artwork.webp",
  },
] as const;

export type ProductId = (typeof products)[number]["id"];

// Verified public company facts. Add a fact here only once it has a public source.
export const company = {
  type: "Independent software company",
  country: "Canada",
  countryCode: "CA",
  // Date the About page's key facts were last checked against current sources.
  factsReviewed: "2026-09-24",
} as const;

export type Founder = {
  id: string;
  slug: string;
  name: string;
  role: string;
  portfolioUrl: `/${string}/`;
};

// Public founder profiles and their portfolio routes share this content.
export const founders: readonly Founder[] = [
  { id: "01", slug: "zainpi", name: "Zain Piyarali", role: "Co-founder", portfolioUrl: "/zainpi/" },
  { id: "02", slug: "raishaikh", name: "Raid Shakih", role: "Co-founder", portfolioUrl: "/raishaikh/" },
  { id: "03", slug: "mikaelsid", name: "Mikael Siddiqui", role: "Co-founder", portfolioUrl: "/mikaelsid/" },
];
