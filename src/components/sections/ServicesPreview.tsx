import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { homeServices } from "@/lib/content";
import { ArrowRightIcon } from "@/components/icons";

export function ServicesPreview() {
  return (
    <section className="section-spacing">
      <div className="container-page">
        <SectionHeading
          eyebrow="What We Do"
          title={
            <>
              Automation solutions built around{" "}
              <span className="text-gradient-brand">your operations</span>
            </>
          }
          description="From AI agents to end-to-end workflow automation, we design systems that integrate with the tools you already use."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {homeServices.map((service, i) => (
            <Reveal key={service.id} delay={(i % 3) * 0.08}>
              <Link
                href={`/services#${service.id}`}
                className="surface surface-hover group flex h-full flex-col gap-4 p-7"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 text-brand-200 ring-1 ring-inset ring-brand-400/25 transition-colors group-hover:text-white">
                  <service.icon className="h-6 w-6" />
                </span>
                <h3 className="text-xl font-semibold text-white">
                  {service.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {service.short}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-brand-300 transition-colors group-hover:text-brand-200">
                  Learn more
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <ButtonLink href="/services" variant="secondary" size="lg" withArrow>
            Explore all services
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
