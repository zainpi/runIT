import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { company } from "@/lib/company";
import { analyticsConfigured } from "@/lib/analytics";
import styles from "@/app/home.module.css";
import { CookieSettingsButton } from "./CookieSettingsButton";

export function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark} aria-label="runsIT home">
      runs<span>IT</span><span className={styles.wordmarkDot}>.</span>
    </Link>
  );
}

type Section = "about" | "contact";

export function SiteHeader({ current, productsHref = "/#products" }: { current?: Section; productsHref?: string }) {
  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Wordmark />
        <nav className={styles.nav} aria-label="Primary">
          <a href={productsHref}>Products</a>
          <Link href="/templates/">AI templates</Link>
          <Link href="/about/" aria-current={current === "about" ? "page" : undefined}>About us</Link>
        </nav>
        <Link className={styles.headerContact} href="/contact/" aria-current={current === "contact" ? "page" : undefined}>
          Say hello <ArrowRightIcon />
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter({ topHref }: { topHref?: string }) {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <Wordmark />
        <nav className={styles.footerLinks} aria-label="Footer">
          <Link href="/about/">About</Link>
          <Link href="/contact/">Contact</Link>
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
          {analyticsConfigured && <CookieSettingsButton />}
        </nav>
        <p>
          © {new Date().getFullYear()} runsIT. Built with care in {company.country}.
          {company.mailingAddress && <> <span className={styles.footerAddress}>{company.mailingAddress}</span></>}
        </p>
        {topHref && <a href={topHref}>Back to top ↑</a>}
      </div>
    </footer>
  );
}
