import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { CtaBand } from "@/components/sections/CtaBand";
import { services } from "@/lib/content";
import { CheckIcon, ArrowRightIcon } from "@/components/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Automation Services — Workflow, CRM & Lead Automation",
  description:
    "Explore our AI automation services: AI agents, workflow automation, CRM automation, lead automation, customer support systems, internal operations, and reporting & analytics.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title={
          <>
            AI automation services that drive{" "}
            <span className="text-gradient">real business outcomes</span>
          </>
        }
        description="We design, build, and maintain intelligent systems that integrate with your existing tools. Every engagement is focused on saving time, cutting costs, and helping you scale."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/book" withArrow>
            Book a Free Strategy Call
          </ButtonLink>
          <ButtonLink href="/case-studies" variant="secondary">
            See Results
          </ButtonLink>
        </div>
      </PageHero>

      {/* Quick nav */}
      <nav
        aria-label="Services"
        className="border-y border-white/10 bg-ink-900/30"
      >
        <div className="container-page flex gap-2 overflow-x-auto py-4">
          {services.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition-colors hover:border-brand-400/40 hover:text-white"
            >
              {s.title}
            </a>
          ))}
        </div>
      </nav>

      <div className="container-page section-spacing flex flex-col gap-20 sm:gap-28">
        {services.map((service, i) => (
          <section
            key={service.id}
            id={service.id}
            className="scroll-mt-28"
          >
            <div
              className={[
                "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : "",
              ].join(" ")}
            >
              {/* Copy */}
              <Reveal>
                <div className="flex flex-col gap-5">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 text-brand-200 ring-1 ring-inset ring-brand-400/25">
                    <service.icon className="h-7 w-7" />
                  </span>
                  <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {service.title}
                  </h2>
                  <p className="text-lg leading-relaxed text-slate-400">
                    {service.description}
                  </p>
                  <div className="flex flex-col gap-3 pt-1">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Common use cases
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {service.useCases.map((uc) => (
                        <li
                          key={uc}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-slate-300"
                        >
                          {uc}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-2">
                    <ButtonLink href="/book" variant="secondary" withArrow>
                      Discuss your use case
                    </ButtonLink>
                  </div>
                </div>
              </Reveal>

              {/* Outcomes panel */}
              <Reveal delay={0.1}>
                <div className="surface relative overflow-hidden p-8">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/15 blur-3xl" />
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                    Expected outcomes
                  </h3>
                  <ul className="mt-5 flex flex-col gap-4">
                    {service.outcomes.map((o) => (
                      <li key={o} className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                          <CheckIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-slate-200">{o}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 rounded-2xl bg-gradient-to-r from-brand-500/10 to-accent-cyan/5 p-5 ring-1 ring-inset ring-brand-400/15">
                    <p className="text-sm text-slate-300">
                      Not sure if this fits?{" "}
                      <a
                        href={`mailto:${site.email}`}
                        className="inline-flex items-center gap-1 font-medium text-brand-200 hover:text-brand-100"
                      >
                        Ask us
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </a>{" "}
                      — we&apos;ll tell you straight.
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        ))}
      </div>

      <CtaBand
        eyebrow="Let's Talk"
        title="Find your biggest automation opportunity"
        description="Tell us about your workflows and we'll show you exactly where automation can save the most time and money."
      />
    </>
  );
}
