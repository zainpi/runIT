import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { benefits } from "@/lib/content";

export function BenefitsSection() {
  return (
    <section className="section-spacing">
      <div className="container-page">
        <SectionHeading
          eyebrow="The Payoff"
          title={
            <>
              Measurable results,{" "}
              <span className="text-gradient-brand">not just software</span>
            </>
          }
          description="We focus on business outcomes. Here's the kind of impact automation delivers."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b, i) => (
            <Reveal key={b.label} delay={(i % 3) * 0.08}>
              <div className="surface surface-hover flex h-full flex-col gap-3 p-7">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-accent-cyan ring-1 ring-inset ring-white/10">
                    <b.icon className="h-5 w-5" />
                  </span>
                  <span className="text-2xl font-semibold text-white">
                    {b.stat}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">{b.label}</h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {b.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
