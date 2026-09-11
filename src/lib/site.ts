/**
 * Central site configuration.
 * Rebrand the entire website by editing the values here.
 */
export const site = {
  name: "runsIT",
  legalName: "runsIT",
  tagline: "Independent software studio",
  // Used for absolute URLs, sitemap, and structured data.
  url: "https://runsit.ca",
  description:
    "runsIT is an independent Canadian software company building business tools, consumer apps, and games. Explore Neutronium, PulseDeals, and The Last Echo, and meet our three founders.",
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
  // Start a fresh document so marketing scripts never share the admin shell.
  { label: "Neutronium", href: "/neutronium", external: true },
  { label: "Services", href: "/services" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  // Static landing page served by the Cloudflare Worker, outside Next's router.
  { label: "The Last Echo", href: "/the-last-echo", external: true },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Solutions",
    links: [
      { label: "AI Agents", href: "/services#ai-agents" },
      { label: "Workflow Automation", href: "/services#workflow-automation" },
      { label: "CRM Automation", href: "/services#crm-automation" },
      { label: "Lead Automation", href: "/services#lead-automation" },
      { label: "Customer Support", href: "/services#customer-support" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Case Studies", href: "/case-studies" },
      { label: "Contact", href: "/contact" },
      { label: "Book a Call", href: "/book" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Reporting & Analytics", href: "/services#reporting-analytics" },
      { label: "Internal Operations", href: "/services#internal-operations" },
      { label: "Our Process", href: "/#process" },
    ],
  },
];
