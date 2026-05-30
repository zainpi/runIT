import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { problems } from "@/lib/content";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

export function ProblemSection() {
  return (
    <section className="section-spacing">
      <div className="container-page">
        <SectionHeading
          eyebrow="The Problem"
          title={
            <>
              Your team is losing{" "}
              <span className="text-gradient-brand">dozens of hours</span> every
              week
            </>
          }
          description="Most businesses waste enormous amounts of time on repetitive tasks that don't need a human. It's slow, expensive, and easy to get wrong."
        />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
          {/* Problem list */}
          <div className="grid gap-3 sm:grid-cols-2">
            {problems.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.06}>
                <div className="surface flex items-center gap-3.5 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-slate-200">
                    {p.title}
                  </span>
                </div>
              </Reveal>
            ))}
            <Reveal delay={problems.length * 0.06}>
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                …and everything in between
              </div>
            </Reveal>
          </div>

          {/* Solution panel */}
          <Reveal delay={0.1}>
            <div className="surface relative overflow-hidden p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
              <div className="flex items-center gap-2 text-sm font-medium text-brand-200">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 ring-1 ring-inset ring-brand-400/30">
                  The fix
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">
                Automation does it for you — instantly and accurately
              </h3>
              <p className="mt-3 text-slate-400">
                We replace manual processes with intelligent systems that run
                24/7. The work still gets done — it just doesn&apos;t cost your
                team their time.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {[
                  "Done in seconds, not hours",
                  "No missed steps or human error",
                  "Works around the clock, every day",
                  "Scales as your business grows",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-200">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
