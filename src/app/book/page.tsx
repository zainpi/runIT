import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/Reveal";
import { LeadForm } from "@/components/forms/LeadForm";
import { ButtonLink } from "@/components/ui/Button";
import { site } from "@/lib/site";
import {
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  ChartIcon,
  ShieldIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Book a Free Strategy Call — Find Your Automation Opportunities",
  description:
    "Book a free 30-minute strategy call. We'll review your workflows and identify the highest-impact automation opportunities for your business. No commitment.",
  alternates: { canonical: "/book" },
};

const expectations = [
  {
    icon: ChartIcon,
    title: "A clear automation roadmap",
    description:
      "We'll pinpoint the workflows with the highest ROI and outline how to automate them.",
  },
  {
    icon: ClockIcon,
    title: "Realistic time & cost savings",
    description:
      "An honest estimate of the hours and money automation can save your business.",
  },
  {
    icon: ShieldIcon,
    title: "No pressure, no jargon",
    description:
      "It's a conversation, not a pitch. You'll leave with value whether we work together or not.",
  },
];

export default function BookPage() {
  return (
    <>
      <PageHero
        eyebrow="Free Strategy Call"
        title={
          <>
            Let&apos;s find your biggest{" "}
            <span className="text-gradient">automation opportunities</span>
          </>
        }
        description="A free, no-obligation 30-minute call. Answer a few quick questions below and we'll match you with the right specialist and the best time to talk."
      />

      <section className="pb-8">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          {/* What to expect */}
          <Reveal>
            <div className="flex flex-col gap-6">
              <div className="surface p-7">
                <div className="flex items-center gap-2 text-sm font-medium text-brand-200">
                  <ClockIcon className="h-4 w-4" /> 30 minutes · Free · Online
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">
                  What to expect on the call
                </h2>
                <ul className="mt-5 flex flex-col gap-5">
                  {expectations.map((e) => (
                    <li key={e.title} className="flex gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 text-brand-200 ring-1 ring-inset ring-brand-400/25">
                        <e.icon className="h-5 w-5" />
                      </span>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-white">
                          {e.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-400">
                          {e.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="surface flex flex-col gap-3 p-7">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Who it&apos;s for
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {[
                    "Teams losing hours to manual work",
                    "Businesses ready to scale efficiently",
                    "Anyone curious where AI fits in their ops",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-sm text-slate-200"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          {/* Questionnaire */}
          <Reveal delay={0.1}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-white">
                  Tell us about your business
                </h2>
                <p className="text-sm text-slate-400">
                  This quick questionnaire helps us prepare so the call is
                  valuable from minute one.
                </p>
              </div>
              <LeadForm variant="booking" />

              {/* Calendar integration slot */}
              <CalendarEmbed />
            </div>
          </Reveal>
        </div>
      </section>

      <div className="py-12" />
    </>
  );
}

/**
 * Placeholder for a calendar booking integration (Calendly, Cal.com, etc.).
 * Replace this block with the provider's embed script/iframe, or keep it as a
 * styled link to the scheduling page configured in `site.calendarUrl`.
 */
function CalendarEmbed() {
  return (
    <div className="surface relative overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/15 blur-3xl" />
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 text-brand-200 ring-1 ring-inset ring-brand-400/25">
        <CalendarIcon className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-white">
        Prefer to pick a time now?
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
        Jump straight to our calendar and book a slot that works for you. (Embed
        your scheduling tool here for instant booking.)
      </p>
      <ButtonLink href={site.calendarUrl} className="mt-5" withArrow>
        Open the Calendar
      </ButtonLink>
    </div>
  );
}
