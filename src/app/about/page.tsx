import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CtaBand } from "@/components/sections/CtaBand";
import {
  SparklesIcon,
  GearIcon,
  ChartIcon,
  ShieldIcon,
  BrainIcon,
  CheckIcon,
} from "@/components/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About — Your AI Automation Partner",
  description:
    "We're an AI automation agency focused on delivering measurable ROI. Learn about our mission, expertise, and partnership-driven approach to business automation.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    icon: ChartIcon,
    title: "ROI-first, always",
    description:
      "We prioritize automations by business impact. If it won't save time or money, we won't build it.",
  },
  {
    icon: GearIcon,
    title: "Built on your stack",
    description:
      "We integrate with the tools you already use instead of forcing you to rip and replace.",
  },
  {
    icon: ShieldIcon,
    title: "Reliable by design",
    description:
      "Our systems are monitored and maintained so they keep delivering long after launch.",
  },
  {
    icon: BrainIcon,
    title: "Outcomes over jargon",
    description:
      "We speak in business results, not buzzwords. You'll always understand what we're building and why.",
  },
];

const expertise = [
  "AI Agents",
  "Workflow Automation",
  "Business Process Automation",
  "CRM Automation",
  "Lead Generation Systems",
  "Customer Support Automation",
  "Custom Integrations",
  "Data Processing & Reporting",
  "Internal Business Tools",
  "AI-Powered Knowledge Bases",
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={
          <>
            Your trusted partner in{" "}
            <span className="text-gradient">AI automation</span>
          </>
        }
        description="We help businesses eliminate repetitive work and streamline operations with AI-powered automation — and we stick around to make sure it keeps paying off."
      />

      {/* Mission */}
      <section className="section-spacing">
        <div className="container-page grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <div className="flex flex-col gap-5">
              <span className="eyebrow">
                <SparklesIcon className="h-3.5 w-3.5" />
                Our Mission
              </span>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Give businesses their time back
              </h2>
              <p className="text-lg leading-relaxed text-slate-400">
                Every hour your team spends on repetitive, manual work is an hour
                not spent serving customers or growing the business. Our mission
                is simple: design intelligent systems that quietly handle the
                busywork so your people can focus on what actually moves the
                needle.
              </p>
              <p className="leading-relaxed text-slate-400">
                We&apos;re technology-agnostic by design. We work with whatever
                platforms fit your needs — from AI models to automation tools,
                CRMs, and APIs — but our focus is always on the business outcome,
                never the tool for its own sake.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 gap-4">
              {[
                { stat: "10–40+", label: "Hours saved weekly" },
                { stat: "24/7", label: "Always-on systems" },
                { stat: "100%", label: "Built on your tools" },
                { stat: "Long-term", label: "Support & optimization" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="surface flex flex-col gap-1 p-6"
                >
                  <span className="text-3xl font-semibold text-gradient-brand">
                    {item.stat}
                  </span>
                  <span className="text-sm text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values / Approach */}
      <section className="section-spacing">
        <div className="container-page">
          <SectionHeading
            eyebrow="Our Approach"
            title={
              <>
                How we work as your{" "}
                <span className="text-gradient-brand">automation partner</span>
              </>
            }
            description="A long-term partnership built on trust, transparency, and a relentless focus on results."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={(i % 2) * 0.08}>
                <div className="surface surface-hover flex h-full gap-5 p-7">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 text-brand-200 ring-1 ring-inset ring-brand-400/25">
                    <v.icon className="h-6 w-6" />
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {v.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {v.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Expertise */}
      <section className="section-spacing">
        <div className="container-page">
          <div className="surface relative overflow-hidden p-8 sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="flex flex-col gap-4">
                <span className="eyebrow">Our Expertise</span>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Deep capability across the automation stack
                </h2>
                <p className="leading-relaxed text-slate-400">
                  Whatever the workflow, we&apos;ve likely automated something
                  like it. We bring proven patterns and adapt them to your
                  business.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {expertise.map((e) => (
                  <li
                    key={e}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-400/15 text-brand-200">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="section-spacing">
        <div className="container-page">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <span className="eyebrow mx-auto">Our Commitment</span>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                We&apos;re only successful when{" "}
                <span className="text-gradient-brand">you see ROI</span>
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-400">
                We measure our work by the time you save and the costs you cut —
                not the lines of code we ship. That&apos;s why we offer ongoing
                support and optimization, treating every engagement as a
                long-term partnership rather than a one-off project. Have a
                question? Reach us anytime at{" "}
                <a
                  href={`mailto:${site.email}`}
                  className="font-medium text-brand-200 hover:text-brand-100"
                >
                  {site.email}
                </a>
                .
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
