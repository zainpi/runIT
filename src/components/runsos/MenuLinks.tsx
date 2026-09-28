"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuLink } from "./MenuBar";

const trim = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);

/** Menu bar links; the page you are on is marked as current. */
export function MenuLinks({ links }: { links: MenuLink[] }) {
  const pathname = trim(usePathname() ?? "/");
  return links.map((link) => {
    const isPage = link.href.startsWith("/") && !link.href.includes("#");
    const current = isPage && trim(link.href) === pathname ? "page" : undefined;
    return isPage ? (
      <Link key={link.href} href={link.href} aria-current={current}>{link.label}</Link>
    ) : (
      <a key={link.href} href={link.href}>{link.label}</a>
    );
  });
}
