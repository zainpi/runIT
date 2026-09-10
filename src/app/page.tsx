import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { founders, products } from "@/lib/company";
import { site } from "@/lib/site";
import styles from "./home.module.css";

function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark} aria-label="runsIT home">
      runs<span>IT</span><span className={styles.wordmarkDot}>.</span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Wordmark />
          <nav className={styles.nav} aria-label="Primary">
            <a href="#company">Company</a>
            <a href="#products">Products</a>
            <a href="#founders">Founders</a>
          </nav>
          <a className={styles.headerContact} href={`mailto:${site.email}`}>
            Say hello <ArrowRightIcon />
          </a>
        </div>
      </header>

      <main id="main" className={styles.container}>
        <section className={styles.hero} id="company" aria-labelledby="company-heading">
          <p className={styles.eyebrow}><span /> Independent software. Built in Canada.</p>
          <h1 id="company-heading">Good ideas.<br />Built to <span>run.</span></h1>
          <div className={styles.heroBottom}>
            <p className={styles.intro}>
              We’re runsIT, an independent software company building tools for
              work, apps for everyday life, and games to get lost in. Three
              founders, bringing ideas to life through thoughtful design and
              hands-on engineering.
            </p>
            <a className={styles.primaryLink} href="#products">
              Explore our products <ArrowRightIcon />
            </a>
          </div>
        </section>

        <section className={styles.products} id="products" aria-labelledby="products-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>01 / Our products</p>
              <h2 id="products-heading">Different ideas. Same care.</h2>
            </div>
            <p>From your workday to your downtime.</p>
          </div>
          <div className={styles.productGrid}>
            {products.map((product) => (
              <a
                key={product.id}
                href={product.href}
                className={`${styles.productCard} ${styles[product.id]}`}
                aria-label={product.action}
              >
                <div className={styles.productArtwork} aria-hidden="true">
                  {product.id === "the-last-echo" ? (
                    <span className={styles.gameTitle}>THE LAST<br /><strong>ECHO</strong></span>
                  ) : (
                    <span className={styles.productMonogram}>{product.monogram}</span>
                  )}
                  <span className={styles.artworkLabel}>{product.name}</span>
                  <span className={styles.productArrow}><ArrowRightIcon /></span>
                </div>
                <div className={styles.productContent}>
                  <p className={styles.productCategory}>{product.category}</p>
                  <h3>{product.name}</h3>
                  <p className={styles.productDescription}>{product.description}</p>
                  <span className={styles.productAction}>{product.action} <ArrowRightIcon /></span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.founders} id="founders" aria-labelledby="founders-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>02 / The founders</p>
              <h2 id="founders-heading">The people behind runsIT.</h2>
            </div>
            <p>A small team, involved from idea to release.</p>
          </div>
          <div className={styles.founderGrid}>
            {founders.map((founder) => (
              <article key={founder.id} className={styles.founderCard}>
                <span className={styles.founderNumber} aria-hidden="true">{founder.id}</span>
                <div className={styles.founderAvatar} aria-hidden="true">
                  {founder.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
                </div>
                <h3>{founder.name}</h3>
                <p>{founder.role}</p>
                <Link
                  className={styles.portfolioLink}
                  href={founder.portfolioUrl}
                  aria-label={`View ${founder.name}’s portfolio`}
                >
                  View portfolio <ArrowRightIcon />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.contact} id="contact" aria-labelledby="contact-heading">
          <div>
            <p className={styles.sectionLabel}>Get in touch</p>
            <h2 id="contact-heading">Let’s make something happen.</h2>
          </div>
          <a href={`mailto:${site.email}`}>{site.email} <ArrowRightIcon /></a>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <Wordmark />
          <p>© {new Date().getFullYear()} runsIT. Built with care in Canada.</p>
          <a href="#company">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
