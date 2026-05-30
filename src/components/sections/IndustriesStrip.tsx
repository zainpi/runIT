import { Reveal } from "@/components/Reveal";

const industries = [
  "E-commerce Brands",
  "Marketing Agencies",
  "Real Estate Teams",
  "Service Businesses",
  "Professional Firms",
  "Growing Startups",
];

export function IndustriesStrip() {
  return (
    <section className="border-y border-white/10 bg-ink-900/30 py-12">
      <div className="container-page">
        <Reveal className="flex flex-col items-center gap-7">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
            Trusted by teams across industries
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {industries.map((name) => (
              <span
                key={name}
                className="text-base font-medium text-slate-400 transition-colors hover:text-slate-200 sm:text-lg"
              >
                {name}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
