import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { site } from "@/lib/site";
import home from "../../home.module.css";
import styles from "../../content-page.module.css";

export const metadata: Metadata = {
  title: "Message sent",
  description: "Thanks for contacting runsIT. Your message has been sent.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/contact/thanks/" },
};

export default function ContactThanksPage() {
  return (
    <div className={`${home.home} ${styles.page}`}>
      <SiteHeader current="contact" />
      <main id="main" className={home.container}>
        <section className={styles.hero} aria-labelledby="thanks-heading">
          <p className={home.eyebrow}><span /> Message sent</p>
          <h1 id="thanks-heading">Thanks. <span>We’ve got your message.</span></h1>
          <p className={styles.lead}>
            We’ll reply to the email address you gave us. If you need to add something, email <a href={`mailto:${site.email}`}>{site.email}</a> and mention your earlier message.
          </p>
          <div className={styles.actions}>
            <Link className={home.primaryLink} href="/">Back to the homepage <ArrowRightIcon /></Link>
            <Link className={home.secondaryLink} href="/templates/">Browse AI templates <ArrowRightIcon /></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
