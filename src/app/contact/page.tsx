import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/Reveal";
import { LeadForm } from "@/components/forms/LeadForm";
import { ButtonLink } from "@/components/ui/Button";
import { site } from "@/lib/site";
import {
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact — Book Your Free Automation Consultation",
  description:
    "Get in touch with our AI automation team. Tell us about your challenge and book a free consultation to discover where automation can create the biggest impact.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const details = [
    {
      icon: MailIcon,
      label: "Email us",
      value: site.email,
      href: `mailto:${site.email}`,
    },
    {
      icon: PhoneIcon,
      label: "Call us",
      value: site.phone,
      href: `tel:${site.phoneHref}`,
    },
    {
      icon: MapPinIcon,
      label: "Location",
      value: site.location,
    },
    {
      icon: ClockIcon,
      label: "Response time",
      value: "Within one business day",
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Let&apos;s talk about{" "}
            <span className="text-gradient">automating your business</span>
          </>
        }
        description="Tell us about your biggest time drain and we'll show you where AI automation can help. Fill out the form or reach us directly — we read every message."
      />

      <section className="pb-8">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          {/* Contact details */}
          <Reveal>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                {details.map((d) => {
                  const content = (
                    <div className="surface surface-hover flex items-center gap-4 p-5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 text-brand-200 ring-1 ring-inset ring-brand-400/25">
                        <d.icon className="h-5 w-5" />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider text-slate-500">
                          {d.label}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {d.value}
                        </span>
                      </div>
                    </div>
                  );
                  return d.href ? (
                    <a key={d.label} href={d.href} className="block">
                      {content}
                    </a>
                  ) : (
                    <div key={d.label}>{content}</div>
                  );
                })}
              </div>

              {/* Booking promo */}
              <div className="surface relative overflow-hidden p-6">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/20 blur-2xl" />
                <CalendarIcon className="h-6 w-6 text-accent-cyan" />
                <h3 className="mt-3 text-lg font-semibold text-white">
                  Prefer to book directly?
                </h3>
                <p className="mt-1.5 text-sm text-slate-400">
                  Skip the form and grab a time on our calendar for a free
                  30-minute strategy call.
                </p>
                <ButtonLink
                  href="/book"
                  variant="secondary"
                  className="mt-4"
                  withArrow
                >
                  Book a Free Call
                </ButtonLink>
              </div>
            </div>
          </Reveal>

          {/* Form */}
          <Reveal delay={0.1}>
            <LeadForm variant="contact" />
          </Reveal>
        </div>
      </section>

      <div className="py-16" />
    </>
  );
}
