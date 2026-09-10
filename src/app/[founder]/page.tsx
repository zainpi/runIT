import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "@/components/icons";
import { founders, products } from "@/lib/company";
import { site } from "@/lib/site";
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

export default async function FounderPortfolio({ params }: PageProps) {
  const { founder: slug } = await params;
  const founder = founders.find((person) => person.slug === slug);
  if (!founder) notFound();

  return (
    <div className={`${styles.home} ${styles.portfolio}`}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" className={styles.wordmark} aria-label="runsIT home">
            runs<span>IT</span><span className={styles.wordmarkDot}>.</span>
          </Link>
          <nav className={styles.nav} aria-label="Portfolio">
            <a href="#work">Our work</a>
            <Link href="/#founders">Meet the founders</Link>
          </nav>
        </div>
      </header>

      <main id="main" className={styles.container}>
        <section className={`${styles.hero} ${styles.portfolioHero}`} aria-labelledby="founder-heading">
          <p className={styles.eyebrow}><span /> {founder.role} at runsIT</p>
          <h1 id="founder-heading">{founder.name}</h1>
          <div className={styles.heroBottom}>
            <p className={styles.intro}>
              I’m {founder.name}, one of the three founders of runsIT. Together,
              we’re building business tools, consumer apps, and games at our
              independent Canadian software company.
            </p>
            <a className={styles.primaryLink} href="#work">Explore our work <ArrowRightIcon /></a>
          </div>
        </section>

        <section className={styles.products} id="work" aria-labelledby="work-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>Our work at runsIT</p>
              <h2 id="work-heading">What we’re building together.</h2>
            </div>
          </div>
          <div className={styles.portfolioWork}>
            {products.map((product) => (
              <a key={product.id} href={product.href} className={styles.portfolioProject}>
                <div>
                  <p className={styles.productCategory}>{product.category}</p>
                  <h3>{product.name}</h3>
                </div>
                <p className={styles.productDescription}>{product.description}</p>
                <span className={styles.productAction}>{product.action} <ArrowRightIcon /></span>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.contact} aria-labelledby="portfolio-contact-heading">
          <div>
            <p className={styles.sectionLabel}>Contact runsIT</p>
            <h2 id="portfolio-contact-heading">Let’s connect.</h2>
          </div>
          <a href={`mailto:${site.email}?subject=${encodeURIComponent(`For ${founder.name}`)}`}>
            Contact {founder.name.split(" ")[0]} <ArrowRightIcon />
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <p>© {new Date().getFullYear()} runsIT · {founder.name}</p>
          <Link href="/">Back to runsIT <ArrowRightIcon /></Link>
        </div>
      </footer>
    </div>
  );
}
