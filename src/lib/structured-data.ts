import { company, founders, xProfileUrl, type Founder } from "./company";
import { site } from "./site";

// Stable IDs let page-level JSON-LD refer to these entities instead of repeating them.
export const organizationId = `${site.url}/#organization`;
export const founderId = (founder: Founder) => `${site.url}${founder.portfolioUrl}#person`;

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": organizationId,
  name: site.legalName,
  url: site.url,
  description: site.description,
  email: site.email,
  address: { "@type": "PostalAddress", addressCountry: company.countryCode },
  founder: founders.map((founder) => ({
    "@type": "Person",
    "@id": founderId(founder),
    name: founder.name,
    jobTitle: founder.role,
    url: `${site.url}${founder.portfolioUrl}`,
    ...(founder.x ? { sameAs: [xProfileUrl(founder.x)] } : {}),
  })),
};
