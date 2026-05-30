import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-brand-600/15 blur-[120px]" />
      </div>
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24 text-center">
        <span className="text-7xl font-semibold text-gradient">404</span>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          This page took the day off
        </h1>
        <p className="max-w-md text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
          Let&apos;s get you back on track.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/" withArrow>
            Back to home
          </ButtonLink>
          <ButtonLink href="/book" variant="secondary">
            Book a Free Call
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
