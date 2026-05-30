import { Hero } from "@/components/sections/Hero";
import { IndustriesStrip } from "@/components/sections/IndustriesStrip";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { ServicesPreview } from "@/components/sections/ServicesPreview";
import { BenefitsSection } from "@/components/sections/BenefitsSection";
import { ProcessSection } from "@/components/sections/ProcessSection";
import { Testimonials } from "@/components/sections/Testimonials";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/JsonLd";
import { services } from "@/lib/content";
import { site } from "@/lib/site";

const professionalServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: site.legalName,
  description: site.description,
  url: site.url,
  email: site.email,
  telephone: site.phone,
  priceRange: "$$",
  areaServed: "Worldwide",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "AI Automation Services",
    itemListElement: services.map((s) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: s.title,
        description: s.short,
      },
    })),
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={professionalServiceJsonLd} />
      <Hero />
      <IndustriesStrip />
      <ProblemSection />
      <ServicesPreview />
      <BenefitsSection />
      <ProcessSection />
      <Testimonials />
      <CtaBand />
    </>
  );
}
