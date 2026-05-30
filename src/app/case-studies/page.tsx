import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/Reveal";
import { CtaBand } from "@/components/sections/CtaBand";
import { caseStudies } from "@/lib/content";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Case Studies — Automation Results for Real Businesses",
  description:
    "See how businesses used AI automation to save 25+ hours per week, cut support tickets, and increase booking conversions. Example case studies and measurable outcomes.",
  alternates: { canonical: "/case-studies" },
};

export default function CaseStudiesPage() {
  return (
    <>
      <PageHero
        eyebrow="Case Studies"
        title={
          <>
            Automation that delivers{" "}
            <span className="text-gradient">measurable ROI</span>
          </>
        }
        description="Representative examples of the kind of results we deliver across industries. Every project is built around your specific workflows and goals."
      />

      <div className="container-page section-spacing flex flex-col gap-8">
        {caseStudies.map((cs, i) => (
          <Reveal key={cs.id} delay={i * 0.05}>
            <article className="surface overflow-hidden">
              <div className="grid lg:grid-cols-[1.5fr_1fr]">
                {/* Narrative */}
                <div className="flex flex-col gap-6 p-8 sm:p-10">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-inset ring-brand-400/25">
                      {cs.industry}
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {cs.title}
                  </h2>
                  <p className="text-slate-400">{cs.summary}</p>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-300/80">
                        The challenge
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-400">
                        {cs.challenge}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300/80">
                        The solution
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-400">
                        {cs.solution}
                      </p>
                    </div>
                  </div>

                  <ul className="flex flex-col gap-2.5 border-t border-white/10 pt-6">
                    {cs.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-center gap-3 text-sm text-slate-200"
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Results sidebar */}
                <div className="relative flex flex-col justify-center gap-6 border-t border-white/10 bg-gradient-to-b from-brand-500/[0.07] to-transparent p-8 sm:p-10 lg:border-l lg:border-t-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    Results
                  </h3>
                  <div className="flex flex-col gap-6">
                    {cs.results.map((r) => (
                      <div key={r.label} className="flex flex-col gap-1">
                        <span className="text-4xl font-semibold text-gradient-brand">
                          {r.stat}
                        </span>
                        <span className="text-sm text-slate-400">{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        ))}

        <Reveal>
          <p className="mx-auto max-w-2xl text-center text-sm text-slate-500">
            These are representative examples illustrating typical engagements
            and outcomes. Results vary based on your workflows, tools, and goals.
          </p>
        </Reveal>
      </div>

      <CtaBand
        title="Want results like these?"
        description="Book a free strategy call and we'll map out the automation opportunities with the highest ROI for your business."
      />
    </>
  );
}
