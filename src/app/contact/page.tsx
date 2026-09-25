import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { company } from "@/lib/company";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";
import home from "../home.module.css";
import styles from "../content-page.module.css";
import { ContactForm } from "./ContactForm";

const title = "Contact runsIT";
const description = "Ask about PulseDeals, The Last Echo, Local Lore, Build Your Room or Neutronium, get help with an AI template order, or suggest a custom template.";

export const metadata: Metadata = {
  title: { absolute: `${title} — Questions, support and template ideas` },
  description,
  alternates: { canonical: "/contact/" },
  openGraph: { type: "website", url: "/contact/", siteName: site.name, title, description, locale: "en_CA", images: [siteSocialImage] },
  twitter: { card: "summary_large_image", title, description, images: [siteSocialImage] },
};

export default function ContactPage() {
  return (
    <div className={`${home.home} ${styles.page}`}>
      <SiteHeader current="contact" />
      <main id="main" className={home.container}>
        <section className={styles.hero} aria-labelledby="contact-heading">
          <p className={home.eyebrow}><span /> Contact</p>
          <h1 id="contact-heading">Get in <span>touch.</span></h1>
          <p className={styles.lead}>
            A question about one of our products, help with a template order, or an idea for a custom template? Send us a note and we’ll reply by email.
          </p>
        </section>
        <div className={styles.contactGrid}>
          <section aria-label="Contact form">
            <ContactForm />
          </section>
          <aside className={styles.aside} aria-label="Other ways to reach us">
            <div className={styles.asideCard}>
              <h2>Prefer email?</h2>
              <p>Write to <a href={`mailto:${site.email}`}>{site.email}</a>. It reaches the same team.</p>
            </div>
            <div className={styles.asideCard}>
              <h2>Product help</h2>
              <ul>
                <li><a href="/pulsedeals/support.html">PulseDeals support</a></li>
                <li><a href="/the-last-echo/support.html">The Last Echo support</a></li>
                <li><Link href="/templates/library/">Open your purchased templates</Link></li>
              </ul>
            </div>
            {company.mailingAddress && (
              <div className={styles.asideCard}>
                <h2>Mailing address</h2>
                <p>{company.mailingAddress}</p>
              </div>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
