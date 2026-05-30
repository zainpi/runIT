import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { processSteps } from "@/lib/content";

export function ProcessSection() {
  return (
    <section id="process" className="section-spacing scroll-mt-24">
      <div className="container-page">
        <SectionHeading
          eyebrow="How It Works"
          title={
            <>
              A clear path from{" "}
              <span className="text-gradient-brand">manual to automated</span>
            </>
          }
          description="A proven, low-risk process that gets you to results fast — and keeps improving after launch."
        />

        <div className="relative mt-16">
          {/* Connecting line (desktop) */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block"
          />
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step, i) => (
              <Reveal as="li" key={step.number} delay={i * 0.1}>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <span className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-brand-400/30 bg-ink-900 text-lg font-semibold text-brand-200 shadow-glow">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
