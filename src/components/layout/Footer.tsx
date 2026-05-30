import Link from "next/link";
import { Logo } from "./Logo";
import { site, footerNav } from "@/lib/site";
import { MailIcon, PhoneIcon, MapPinIcon } from "@/components/icons";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-12 border-t border-white/10 bg-ink-900/40">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="flex flex-col gap-5">
            <Logo />
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              {site.legalName} designs, builds, and maintains AI-powered
              automation systems that help businesses save time, cut costs, and
              scale without adding overhead.
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
              <li>
                <a
                  href={`tel:${site.phoneHref}`}
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-white"
                >
                  <PhoneIcon className="h-4 w-4 text-brand-300" />
                  {site.phone}
                </a>
              </li>
              <li className="inline-flex items-center gap-2.5">
                <MapPinIcon className="h-4 w-4 text-brand-300" />
                {site.location}
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
                      <Link
                        href={link.href}
                        className="text-sm text-slate-400 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
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
            <a
              href={site.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              LinkedIn
            </a>
            <a
              href={site.social.x}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              X
            </a>
            <a
              href={site.social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              YouTube
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
