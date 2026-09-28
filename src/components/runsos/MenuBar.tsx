import Link from "next/link";
import { CookieSettingsButton } from "@/components/site/CookieSettingsButton";
import { analyticsConfigured } from "@/lib/analytics";
import { company } from "@/lib/company";
import { BrandMark } from "./BrandMark";
import { MenuLinks } from "./MenuLinks";
import os from "./os.module.css";

export type MenuLink = { label: string; href: string };

export const homeMenu: MenuLink[] = [
  { label: "Products", href: "/#products" },
  { label: "AI templates", href: "/templates/" },
  { label: "About us", href: "/about/" },
  { label: "Contact", href: "/contact/" },
];

/** The runsOS menu bar: brand, primary navigation and a contact shortcut. */
export function MenuBar({ links = homeMenu, label = "Primary" }: { links?: MenuLink[]; label?: string }) {
  return (
    <header className={os.menubar}>
      <div className={os.menubarInner}>
        <Link href="/" className={os.brand} aria-label="runsIT home">
          <BrandMark className={os.brandMark} />
          <span className={os.brandName}>runsIT</span>
        </Link>
        <nav className={os.menuNav} aria-label={label}>
          <MenuLinks links={links} />
        </nav>
        <div className={os.menuRight}>
          <span className={os.menuPill}>Built in Canada</span>
          <Link className={os.menuCta} href="/contact/">Say hello</Link>
        </div>
      </div>
    </header>
  );
}

/** The runsOS footer, drawn as a taskbar. */
export function Taskbar({ note, backHref = "#main", backLabel = "Back to top ↑" }: { note?: string; backHref?: string; backLabel?: string }) {
  return (
    <footer className={os.taskbar}>
      <div className={os.taskbarInner}>
        <Link href="/" className={os.brand} aria-label="runsIT home">
          <BrandMark className={os.brandMark} />
          runsIT
        </Link>
        <span>
          {note ?? `© ${new Date().getFullYear()} runsIT · Built with care in Canada`}
          {company.mailingAddress && <span className={os.taskbarAddress}>{company.mailingAddress}</span>}
        </span>
        <nav className={os.taskbarLinks} aria-label="Footer">
          <Link href="/about/">About</Link>
          <Link href="/contact/">Contact</Link>
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
          {analyticsConfigured && <CookieSettingsButton />}
        </nav>
        <a href={backHref}>{backLabel}</a>
      </div>
    </footer>
  );
}
