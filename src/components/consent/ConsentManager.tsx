"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { analyticsConfigured, CONSENT_OPEN_EVENT, CONSENT_STORAGE_KEY, gaMeasurementId, optionalScriptsAllowed, type ConsentChoice } from "@/lib/analytics";
import styles from "./consent.module.css";

function readChoice(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

// Remove Google Analytics cookies after a visitor withdraws consent.
function clearAnalyticsCookies() {
  const domains = ["", location.hostname, `.${location.hostname.replace(/^www\./, "")}`];
  for (const name of document.cookie.split(";").map((part) => part.split("=")[0].trim())) {
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
  }
}

export function ConsentManager() {
  const path = usePathname();
  const allowed = analyticsConfigured && optionalScriptsAllowed(path);
  // undefined until the stored choice has been read, so nothing flashes during hydration.
  const [choice, setChoice] = useState<ConsentChoice | null | undefined>(undefined);
  const [reopened, setReopened] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => setChoice(readChoice()), []);
  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  const visible = allowed && (reopened || choice === null);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-consent-open", visible);
    if (visible && reopened) heading.current?.focus();
  }, [visible, reopened]);

  // Keep analytics paused on pages where optional scripts never run, even after client navigation.
  useEffect(() => {
    if (!analyticsConfigured) return;
    (window as unknown as Record<string, boolean>)[`ga-disable-${gaMeasurementId}`] = !(allowed && choice === "granted");
  }, [allowed, choice]);

  const decide = useCallback((value: ConsentChoice) => {
    try { localStorage.setItem(CONSENT_STORAGE_KEY, value); } catch { /* The choice still applies for this visit. */ }
    if (value === "denied") clearAnalyticsCookies();
    setChoice(value);
    setReopened(false);
  }, []);

  return (
    <>
      {allowed && choice === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
          <Script id="ga-config" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaMeasurementId}');`}
          </Script>
        </>
      )}
      {visible && (
        <section className={styles.banner} aria-labelledby="consent-heading">
          <h2 id="consent-heading" ref={heading} tabIndex={-1}>Cookies on runsIT</h2>
          <p>
            We’d like to use analytics cookies to understand how people use the site. They’re optional and only load if you accept.
            Storage that keeps the site working is always on. <Link href="/privacy/#cookies">Learn more</Link>
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.accept} onClick={() => decide("granted")}>Accept analytics</button>
            <button type="button" className={styles.decline} onClick={() => decide("denied")}>Decline</button>
          </div>
        </section>
      )}
    </>
  );
}
