import type { Metadata } from "next";
import Image from "next/image";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { MenuBar, Taskbar } from "@/components/runsos/MenuBar";
import { Window } from "@/components/runsos/Window";
import { desktopApps, founderCards } from "@/components/runsos/apps";
import { ArrowIcon } from "@/components/runsos/icons";
import { founders } from "@/lib/company";
import { site } from "@/lib/site";
import os from "@/components/runsos/os.module.css";
import styles from "../home.module.css";

type PageProps = { params: Promise<{ founder: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return founders.map((founder) => ({ founder: founder.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { founder: slug } = await params;
  const founder = founders.find((person) => person.slug === slug);
  if (!founder) notFound();
  const title = `${founder.name} — Portfolio`;
  const description = `${founder.name}, co-founder of runsIT. Explore the business software, consumer apps, and games our team is building.`;
  return {
    title,
    description,
    alternates: { canonical: founder.portfolioUrl },
    openGraph: { title, description, url: founder.portfolioUrl },
    twitter: { title, description },
  };
}

export const viewport = { themeColor: "#ede4d3" };

export default async function FounderPortfolio({ params }: PageProps) {
  const { founder: slug } = await params;
  const founder = founderCards.find((person) => person.slug === slug);
  if (!founder) notFound();
  const firstName = founder.name.split(" ")[0];

  return (
    <div className={os.root} data-os>
      <MenuBar
        label="Portfolio"
        links={[
          { label: "Our work", href: "#work" },
          { label: "Meet the founders", href: "/#founders" },
          { label: "AI templates", href: "/templates/" },
        ]}
      />

      <main id="main" className={`${os.container} ${styles.portfolio}`}>
        <div className={styles.profileRow}>
          <Window as="section" title={`${founder.slug}.profile`} tone={founder.tone} labelledBy="founder-heading" className={styles.profileWindow}>
            <div className={styles.profileBody}>
              <span className={styles.profileAvatar} style={{ background: founder.tone }} aria-hidden="true">{founder.initials}</span>
              <div className={styles.profileText}>
                <p className={`${os.pixel} ${styles.contactKicker}`}>{founder.role} at runsIT</p>
                <h1 id="founder-heading">{founder.name}</h1>
                <p className={styles.contactText}>
                  I’m {founder.name}, one of the three founders of runsIT. Together, we’re building business tools,
                  consumer apps, and games at our independent Canadian software company.
                </p>
                <a className={os.button} href="#work">Explore our work <ArrowIcon /></a>
              </div>
            </div>
          </Window>
          <div className={styles.stickyNote}>
            <p>currently building:</p>
            <ol>
              {desktopApps.map((app) => <li key={app.id}>{app.name}</li>)}
            </ol>
          </div>
        </div>

        <Window as="section" id="work" title="Applications" tone="#ffd23f" meta={`${desktopApps.length} apps`} labelledBy="work-heading">
          <p className={os.toolbar}><span>Our work at runsIT</span><span>Built in Canada</span></p>
          <div className={styles.windowBody}>
            <div className={styles.heading}>
              <h2 id="work-heading">What we’re building together.</h2>
            </div>
            <ul className={styles.appGrid}>
              {desktopApps.map((app) => (
                <li key={app.id} className={styles.appCard}>
                  <a className={styles.appCardMain} href={app.href}>
                    <span className={styles.appCardArt} style={{ background: app.background }}>
                      <Image src={app.image} alt="" width={app.width} height={app.height} className={styles.appCardImage} unoptimized />
                      <span className={os.chip} style={{ "--tone": app.tone } as CSSProperties}>{app.category}</span>
                    </span>
                    <div className={styles.appCardText}>
                      <span className={`${os.pixel} ${styles.fileName}`}>{app.file}</span>
                      <h3>{app.name}</h3>
                      <span className={styles.appCardDescription}>{app.description}</span>
                      <span className={styles.appCardAction}>{app.action} <ArrowIcon /></span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Window>

        <Window as="section" title="hello.txt" tone="#fffdf7" labelledBy="portfolio-contact-heading" className={styles.contactWindow}>
          <div className={styles.windowBody}>
            <p className={`${os.pixel} ${styles.contactKicker}`}>Contact runsIT</p>
            <h2 id="portfolio-contact-heading">Let’s connect.</h2>
            <a className={os.button} href={`mailto:${site.email}?subject=${encodeURIComponent(`For ${founder.name}`)}`}>
              Contact {firstName} <ArrowIcon />
            </a>
          </div>
        </Window>
      </main>

      <Taskbar note={`© ${new Date().getFullYear()} runsIT · ${founder.name}`} backHref="/" backLabel="Back to runsIT →" />
    </div>
  );
}
