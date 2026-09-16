/**
 * Central site configuration.
 * Rebrand the entire website by editing the values here.
 */
export const site = {
  name: "runsIT",
  legalName: "runsIT",
  tagline: "Products & AI templates",
  // Used for absolute URLs, sitemap, and structured data.
  url: "https://runsit.ca",
  description:
    "Explore runsIT apps and games, then build your own with AI templates based on their foundations. No coding experience needed to get started.",
  email: "info@runs-it.com",
  phone: "+1 (555) 018-2240",
  phoneHref: "+15550182240",
  location: "Remote-first · Serving clients worldwide",
  // Set this to your real scheduling link (Calendly, Cal.com, etc.).
  calendarUrl: "https://cal.com/runit/strategy-call",
  social: {
    linkedin: "https://www.linkedin.com/company/runit-automation",
    x: "https://x.com/runit_ai",
    youtube: "https://www.youtube.com/@runit-automation",
  },
} as const;

export type NavLink = { label: string; href: string; external?: boolean };

export const mainNav: NavLink[] = [
  { label: "Products", href: "/#products" },
  { label: "AI Templates", href: "/templates/" },
  { label: "About us", href: "/#founders" },
  { label: "Contact", href: "/#contact" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Products",
    links: [
      { label: "PulseDeals", href: "/pulsedeals/", external: true },
      { label: "The Last Echo", href: "/the-last-echo/", external: true },
      { label: "Local Lore", href: "/local-lore/", external: true },
      { label: "Build Your Room", href: "https://www.roblox.com/games/95318676575728/Build-Your-Room", external: true },
      { label: "Neutronium", href: "https://neutronium.runsit.ca/neutronium/", external: true },
    ],
  },
  {
    title: "AI templates",
    links: [
      { label: "Discord bot", href: "/templates/#discord-bot" },
      { label: "Roblox game", href: "/templates/#roblox-game" },
      { label: "Mobile game", href: "/templates/#mobile-game" },
      { label: "Mobile app", href: "/templates/#mobile-app" },
      { label: "Online store", href: "/templates/#storefront" },
      { label: "Browser game", href: "/templates/#browser-game" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/#founders" },
      { label: "Contact", href: "/#contact" },
      { label: "My templates", href: "/templates/library/" },
    ],
  },
];
