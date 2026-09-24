import Link from "next/link";
import { site } from "@/lib/site";
import os from "./os.module.css";

export type MenuLink = { label: string; href: string; current?: boolean };

export const homeMenu: MenuLink[] = [
  { label: "Products", href: "/#products" },
  { label: "AI templates", href: "/templates/" },
  { label: "About us", href: "/#founders" },
  { label: "Contact", href: "/#contact" },
];

/** The runsOS menu bar: brand, primary navigation and a contact shortcut. */
export function MenuBar({ links = homeMenu, label = "Primary" }: { links?: MenuLink[]; label?: string }) {
  return (
    <header className={os.menubar}>
      <div className={os.menubarInner}>
        <Link href="/" className={os.brand} aria-label="runsIT home">
          <span className={os.brandMark} aria-hidden="true">r</span>
          <span className={os.brandName}>runsIT</span>
        </Link>
        <nav className={os.menuNav} aria-label={label}>
          {links.map((link) =>
            link.href.startsWith("/") && !link.href.includes("#") ? (
              <Link key={link.href} href={link.href} aria-current={link.current ? "page" : undefined}>{link.label}</Link>
            ) : (
              <a key={link.href} href={link.href} aria-current={link.current ? "page" : undefined}>{link.label}</a>
            ),
          )}
        </nav>
        <div className={os.menuRight}>
          <span className={os.menuPill}>Built in Canada</span>
          <a className={os.menuCta} href={`mailto:${site.email}`}>Say hello</a>
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
          <span className={os.brandMark} aria-hidden="true">r</span>
          runsIT
        </Link>
        <span>{note ?? `© ${new Date().getFullYear()} runsIT · Built with care in Canada`}</span>
        <a href={backHref}>{backLabel}</a>
      </div>
    </footer>
  );
}
