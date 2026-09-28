import { MenuBar, Taskbar } from "@/components/runsos/MenuBar";
import { Window } from "@/components/runsos/Window";
import os from "@/components/runsos/os.module.css";
import styles from "@/app/content-page.module.css";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

const formatDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function LegalPage({ file, eyebrow, title, intro, updated, sections }: { file: string; eyebrow: string; title: React.ReactNode; intro: React.ReactNode; updated: string; sections: LegalSection[] }) {
  return (
    <div className={os.root} data-os>
      <MenuBar />
      <main id="main" className={`${os.container} ${styles.page}`}>
        <Window as="section" title={file} tone="#fffdf7" labelledBy="legal-heading">
          <p className={os.toolbar}>
            <span>{eyebrow}</span>
            <span>Effective and last updated <time dateTime={updated}>{formatDate(updated)}</time></span>
          </p>
          <div className={styles.windowBody}>
            <h1 id="legal-heading">{title}</h1>
            <div className={styles.lead}>{intro}</div>
          </div>
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
        </Window>
      </main>
      <Taskbar />
    </div>
  );
}
