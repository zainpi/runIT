/**
 * Central site configuration.
 * Rebrand the entire website by editing the values here.
 */
export const site = {
  name: "runIT",
  legalName: "runIT Automation",
  tagline: "AI Automation Agency",
  // Used for absolute URLs, sitemap, and structured data.
  url: "https://runit.agency",
  description:
    "runIT is an AI automation agency that builds AI-powered systems and workflow automation to help businesses save time, cut costs, and scale without adding overhead.",
  email: "hello@runit.agency",
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
  { label: "Services", href: "/services" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  // Static landing page served by the Cloudflare Worker, outside Next's router.
  { label: "Ancient Horizon", href: "/ancient-horizon", external: true },
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
