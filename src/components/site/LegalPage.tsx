import { SiteFooter, SiteHeader } from "./SiteChrome";
import home from "@/app/home.module.css";
import styles from "@/app/content-page.module.css";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

const formatDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function LegalPage({ eyebrow, title, intro, updated, sections }: { eyebrow: string; title: React.ReactNode; intro: React.ReactNode; updated: string; sections: LegalSection[] }) {
  return (
    <div className={`${home.home} ${styles.page}`}>
      <SiteHeader />
      <main id="main" className={home.container}>
        <section className={styles.hero} aria-labelledby="legal-heading">
          <p className={home.eyebrow}><span /> {eyebrow}</p>
          <h1 id="legal-heading">{title}</h1>
          <div className={styles.lead}>{intro}</div>
          <p className={styles.meta}>Effective and last updated <time dateTime={updated}>{formatDate(updated)}</time></p>
        </section>
        <div className={styles.document}>
          <nav className={styles.toc} aria-label="On this page">
            <p>On this page</p>
            <ol>
              {sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}
            </ol>
          </nav>
          <article className={styles.prose}>
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={section.id}>
                <h2 id={section.id}>{section.title}</h2>
                {section.body}
              </section>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
