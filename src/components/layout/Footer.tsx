import Link from "next/link";
import { Logo } from "./Logo";
import { site, footerNav } from "@/lib/site";
import { MailIcon } from "@/components/icons";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-12 border-t border-white/10 bg-ink-900/40">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="flex flex-col gap-5">
            <Logo />
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              {site.description}
            </p>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-white"
                >
                  <MailIcon className="h-4 w-4 text-brand-300" />
                  {site.email}
                </a>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerNav.map((group) => (
              <div key={group.title} className="flex flex-col gap-3.5">
                <h3 className="text-sm font-semibold text-white">
                  {group.title}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href + link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          className="text-sm text-slate-400 transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-slate-400 transition-colors hover:text-white"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="hairline my-10" />

        <div className="flex flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <p>
            © {year} {site.legalName}. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy/" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms/" className="transition-colors hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
