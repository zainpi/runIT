import type { Metadata } from "next";
import Link from "next/link";
import { MenuBar, Taskbar } from "@/components/runsos/MenuBar";
import { Window } from "@/components/runsos/Window";
import os from "@/components/runsos/os.module.css";
import { company } from "@/lib/company";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";
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
    <div className={os.root} data-os>
      <MenuBar />
      <main id="main" className={`${os.container} ${styles.page}`}>
        <div className={styles.contactLayout}>
          <Window as="section" title="new-message.txt" tone="#ff8a6b" labelledBy="contact-heading">
            <div className={styles.windowBody}>
              <p className={`${os.pixel} ${styles.kicker}`}>Contact</p>
              <h1 id="contact-heading">Get in touch.</h1>
              <p className={styles.lead}>
                A question about one of our products, help with a template order, or an idea for a custom template? Send us a note and we’ll reply by email.
              </p>
              <ContactForm />
            </div>
          </Window>
          <aside className={styles.aside} aria-label="Other ways to reach us">
            <Window as="div" title="email.txt" tone="#ffd23f">
              <div className={styles.asideBody}>
                <p><strong>Prefer email?</strong> Write to <a href={`mailto:${site.email}`}>{site.email}</a>. It reaches the same team.</p>
              </div>
            </Window>
            <Window as="div" title="support" tone="#7fd8c3">
              <div className={styles.asideBody}>
                <p><strong>Product help</strong></p>
                <ul>
                  <li><a href="/pulsedeals/support.html">PulseDeals support</a></li>
                  <li><a href="/the-last-echo/support.html">The Last Echo support</a></li>
                  <li><Link href="/templates/library/">Open your purchased templates</Link></li>
                </ul>
              </div>
            </Window>
            {company.mailingAddress && (
              <Window as="div" title="mailing-address.txt" tone="#c3b1ff">
                <div className={styles.asideBody}><p>{company.mailingAddress}</p></div>
              </Window>
            )}
          </aside>
        </div>
      </main>
      <Taskbar />
    </div>
  );
}
