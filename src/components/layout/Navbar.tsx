"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { ButtonLink } from "@/components/ui/Button";
import { mainNav } from "@/lib/site";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-white/10 bg-ink-950/80 backdrop-blur-xl"
          : "border-b border-transparent",
      ].join(" ")}
    >
      <nav
        className="container-page flex h-16 items-center justify-between sm:h-18"
        aria-label="Primary"
      >
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {mainNav.map((link) => {
            const cls = [
              "rounded-full px-4 py-2 text-sm transition-colors",
              isActive(link.href)
                ? "text-white"
                : "text-slate-400 hover:text-white",
            ].join(" ");
            return link.external ? (
              <a key={link.href} href={link.href} className={cls}>
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={cls}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:block">
          <ButtonLink href="/book" size="md" withArrow>
            Book a Free Call
          </ButtonLink>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-4 w-5">
            <span
              className={[
                "absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform duration-300",
                open ? "translate-y-[7px] rotate-45" : "",
              ].join(" ")}
            />
            <span
              className={[
                "absolute left-0 top-[7px] h-0.5 w-5 bg-current transition-opacity duration-200",
                open ? "opacity-0" : "opacity-100",
              ].join(" ")}
            />
            <span
              className={[
                "absolute left-0 top-[14px] h-0.5 w-5 bg-current transition-transform duration-300",
                open ? "-translate-y-[7px] -rotate-45" : "",
              ].join(" ")}
            />
          </span>
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={[
          "md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <div
          className={[
            "container-page overflow-hidden transition-[max-height,opacity] duration-300",
            open ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="flex flex-col gap-1 border-t border-white/10 py-4">
            {mainNav.map((link) => {
              const cls = [
                "rounded-xl px-4 py-3 text-base transition-colors",
                isActive(link.href)
                  ? "bg-white/[0.06] text-white"
                  : "text-slate-300 hover:bg-white/[0.04] hover:text-white",
              ].join(" ");
              return link.external ? (
                <a key={link.href} href={link.href} className={cls}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className={cls}>
                  {link.label}
                </Link>
              );
            })}
            <ButtonLink href="/book" size="lg" className="mt-3 w-full" withArrow>
              Book a Free Call
            </ButtonLink>
          </div>
        </div>
      </div>
    </header>
  );
}
