export const products = [
  {
    id: "neutronium",
    name: "Neutronium",
    category: "Business software",
    description:
      "A simpler workspace for company IT. Manage onboarding, employee access, and offboarding in one place.",
    href: "https://neutronium.runsit.ca/neutronium/",
    action: "Explore Neutronium",
    monogram: "N",
  },
  {
    id: "heaterdeals",
    name: "HeaterDeals",
    category: "Shopping & discovery",
    description:
      "A live feed of price drops worth moving on. Discover deals across the marketplaces you shop.",
    href: "/heaterdeals/",
    action: "Explore HeaterDeals",
    monogram: "HD",
  },
  {
    id: "the-last-echo",
    name: "The Last Echo",
    category: "Mobile gaming",
    description:
      "An idle RPG with a world to explore. Build your hero, discover new gear, and keep progressing while you’re away.",
    href: "/the-last-echo/",
    action: "Explore The Last Echo",
    monogram: "",
  },
  {
    id: "local-lore",
    name: "Local Lore",
    category: "Browser game · Playable demo",
    description:
      "How well do you know your streets? Try three-round geography challenges with named answers, map pins, and instant scores.",
    href: "/local-lore/",
    action: "Play Local Lore",
    monogram: "LL",
  },
] as const;

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
