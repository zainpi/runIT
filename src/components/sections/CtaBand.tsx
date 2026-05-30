import { Reveal } from "@/components/Reveal";
import { ButtonLink } from "@/components/ui/Button";

type CtaBandProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

/** Reusable conversion band. Used at the bottom of most pages. */
export function CtaBand({
  eyebrow = "Get Started",
  title = "Ready to automate your business?",
  description = "Book a free consultation and discover where AI can create the biggest impact for your team.",
  primaryLabel = "Schedule Your Free Call",
  primaryHref = "/book",
  secondaryLabel = "Contact Us",
  secondaryHref = "/contact",
}: CtaBandProps) {
  return (
    <section className="section-spacing">
      <div className="container-page">
        <Reveal>
          <div className="surface relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* Glow accents */}
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-brand-600/25 blur-[110px]" />
              <div className="absolute inset-0 bg-dotgrid opacity-50" />
            </div>

            <span className="eyebrow mx-auto">{eyebrow}</span>
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              {description}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href={primaryHref} size="lg" withArrow>
                {primaryLabel}
              </ButtonLink>
              <ButtonLink href={secondaryHref} size="lg" variant="secondary">
                {secondaryLabel}
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              No commitment · 30-minute call · Walk away with an automation plan
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
