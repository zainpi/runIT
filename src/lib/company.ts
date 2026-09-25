export const products = [
  {
    id: "pulsedeals",
    name: "PulseDeals",
    category: "Shopping & discovery",
    description:
      "A live feed of price drops worth moving on. Discover deals across the marketplaces you shop.",
    href: "/pulsedeals/",
    action: "Explore PulseDeals",
    artwork: {
      src: "/products/pulsedeals-preview.webp",
      width: 1600,
      height: 800,
      alt: "PulseDeals on iPhone: a feed of Amazon price drops, a deal’s heat score and deal alerts",
    },
  },
  {
    id: "the-last-echo",
    name: "The Last Echo",
    category: "Mobile gaming",
    description:
      "An idle RPG with a world to explore. Build your hero, discover new gear, and keep progressing while you’re away.",
    href: "/the-last-echo/",
    action: "Explore The Last Echo",
    artwork: {
      src: "/products/the-last-echo-preview.webp",
      width: 1600,
      height: 800,
      alt: "The Last Echo on a phone: an auto-battle in the forest in front of a boss fight in a lava world",
    },
  },
  {
    id: "local-lore",
    name: "Local Lore",
    category: "Browser game · Toronto",
    description:
      "Explore Toronto, New York City, Vancouver and London through real Street View photos. Drop a map pin and build your local knowledge across three-round games.",
    href: "/local-lore/",
    action: "Play Local Lore",
    artwork: {
      src: "/products/local-lore-preview.webp",
      width: 1600,
      height: 800,
      alt: "Local Lore in a browser and on a phone: a street scene beside a map with guess and answer pins and a score of 912 out of 1,000",
    },
  },
  {
    id: "build-your-room",
    name: "Build Your Room",
    category: "Roblox game",
    description:
      "Build a bedroom that feels like you. Collect furniture, explore creative dreams, and visit your friends’ rooms on Roblox.",
    href: "https://www.roblox.com/games/95318676575728/Build-Your-Room",
    action: "Play on Roblox",
    artwork: {
      src: "/products/build-your-room-artwork.webp",
      width: 1280,
      height: 720,
      alt: "Build Your Room artwork: a Roblox character in a cozy decorated bedroom, dreaming of painting, studying and singing",
    },
  },
  {
    id: "neutronium",
    name: "Neutronium",
    category: "Business software",
    description:
      "A simpler workspace for company IT. Manage onboarding, employee access, and offboarding in one place.",
    href: "https://neutronium.runsit.ca/neutronium/",
    action: "Explore Neutronium",
    artwork: {
      src: "/products/neutronium-preview.webp",
      width: 1600,
      height: 800,
      alt: "Neutronium dashboard with onboarding and offboarding shortcuts, workspace totals and a pending access request",
    },
  },
] as const;

export type ProductId = (typeof products)[number]["id"];

// Verified public company facts. Add a fact here only once it has a public source.
export const company = {
  type: "Independent software company",
  country: "Canada",
  countryCode: "CA",
  // Public mailing address for the footer, contact page and legal pages. Left empty until
  // the company confirms a real address; nothing renders while it is blank.
  mailingAddress: "" as string,
  // Date the About page's key facts were last checked against current sources.
  factsReviewed: "2026-09-24",
} as const;

export type Founder = {
  id: string;
  slug: string;
  name: string;
  role: string;
  portfolioUrl: `/${string}/`;
  // X (Twitter) handle without the @, when the founder has confirmed it.
  x?: string;
};

export const xProfileUrl = (handle: string) => `https://x.com/${handle}`;

// Public founder profiles and their portfolio routes share this content.
export const founders: readonly Founder[] = [
  { id: "01", slug: "zainpi", name: "Zain Piyarali", role: "Co-founder", portfolioUrl: "/zainpi/", x: "zainpi9" },
  { id: "02", slug: "raishaikh", name: "Raid Shakih", role: "Co-founder", portfolioUrl: "/raishaikh/" },
  { id: "03", slug: "mikaelsid", name: "Mikael Siddiqui", role: "Co-founder", portfolioUrl: "/mikaelsid/" },
];
