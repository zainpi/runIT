import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

/** Compact hero used at the top of inner pages. */
export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-30%] h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-brand-600/15 blur-[120px]" />
        <div className="absolute inset-0 bg-dotgrid opacity-50" />
      </div>
      <div className="container-page py-16 sm:py-24">
        <Reveal className="flex max-w-3xl flex-col gap-5">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
              {description}
            </p>
          )}
          {children && <div className="mt-2">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}
