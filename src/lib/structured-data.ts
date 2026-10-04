import { company, founders, xProfileUrl, type Founder } from "./company";
import { site } from "./site";

// Stable IDs let page-level JSON-LD refer to these entities instead of repeating them.
export const organizationId = `${site.url}/#organization`;
export const websiteId = `${site.url}/#website`;
export const founderId = (founder: Founder) => `${site.url}${founder.portfolioUrl}#person`;

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": organizationId,
  name: site.legalName,
  url: site.url,
  logo: `${site.url}/icon.svg`,
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

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": websiteId,
  name: site.name,
  url: `${site.url}/`,
  description: site.description,
  inLanguage: "en-CA",
  publisher: { "@id": organizationId },
};

export function faqJsonLd(pageUrl: string, questions: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    url: `${pageUrl}#faq`,
    isPartOf: { "@id": `${pageUrl}#webpage` },
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}
