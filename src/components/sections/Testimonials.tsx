import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { testimonials } from "@/lib/content";

function QuoteMark() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden
      className="text-brand-400/40"
    >
      <path
        d="M14 10c-4 1.5-7 5-7 10v6h9v-9h-4c0-3 1.5-5 4-6l-2-1zm15 0c-4 1.5-7 5-7 10v6h9v-9h-4c0-3 1.5-5 4-6l-2-1z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Testimonials() {
  return (
    <section className="section-spacing">
      <div className="container-page">
        <SectionHeading
          eyebrow="Results"
          title={
            <>
              Businesses are getting their{" "}
              <span className="text-gradient-brand">time back</span>
            </>
          }
          description="Real outcomes from teams that replaced manual work with automation."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={(i % 3) * 0.08}>
              <figure className="surface flex h-full flex-col gap-5 p-7">
                <div className="flex items-center justify-between">
                  <QuoteMark />
                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                    {t.metric}
                  </span>
                </div>
                <blockquote className="text-base leading-relaxed text-slate-200">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3 border-t border-white/10 pt-5">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-brand-700/20 text-sm font-semibold text-white ring-1 ring-inset ring-white/10">
                    {t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-white">
                      {t.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {t.role}, {t.company}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
