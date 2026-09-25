import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import home from "./home.module.css";
import styles from "./content-page.module.css";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for isn’t on runsIT. Explore our products, browse AI templates or get in touch.",
  robots: { index: false, follow: true },
};

const destinations = [
  { href: "/#products", title: "Our products", body: "PulseDeals, The Last Echo, Local Lore, Build Your Room and Neutronium." },
  { href: "/templates/", title: "AI templates", body: "Build your own app or game with a guided AI template." },
  { href: "/about/", title: "About runsIT", body: "Who we are, what we make and the team behind it." },
];

export default function NotFound() {
  return (
    <div className={`${home.home} ${styles.page}`}>
      <SiteHeader />
      <main id="main" className={home.container}>
        <section className={styles.hero} aria-labelledby="not-found-heading">
          <p className={home.eyebrow}><span /> Error 404</p>
          <h1 id="not-found-heading">This page <span>isn’t here.</span></h1>
          <p className={styles.lead}>
            The link may be old, or the page may have moved. Try one of the places below, or tell us what you were looking for.
          </p>
          <div className={styles.actions}>
            <Link className={home.primaryLink} href="/">Go to the homepage <ArrowRightIcon /></Link>
            <Link className={home.secondaryLink} href="/contact/">Contact us <ArrowRightIcon /></Link>
          </div>
        </section>
        <section className={styles.section} aria-label="Popular pages">
          <ul className={styles.linkGrid} role="list">
            {destinations.map((item) => (
              <li key={item.href}>
                <Link className={styles.linkCard} href={item.href}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
