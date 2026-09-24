import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "@/components/icons";
import { founders, products } from "@/lib/company";
import { site } from "@/lib/site";
import { templateCatalog } from "@/lib/templates/catalog";
import { templateDemos } from "@/lib/templates/demos";
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
            <a href="#products">Products</a>
            <Link href="/templates/">AI templates</Link>
            <Link href="/about/">About us</Link>
          </nav>
          <a className={styles.headerContact} href={`mailto:${site.email}`}>
            Say hello <ArrowRightIcon />
          </a>
        </div>
      </header>

      <main id="main" className={styles.container}>
        <section className={styles.hero} id="company" aria-labelledby="company-heading">
          <p className={styles.eyebrow}><span /> Products & AI templates. Built in Canada.</p>
          <h1 id="company-heading">Explore our products.<br /><span>Build your own.</span></h1>
          <div className={styles.heroBottom}>
            <p className={styles.intro}>
              We build apps, games and tools you can use today. Our AI templates
              share the foundations behind those products, so you can turn your
              own idea into an app with step-by-step guidance. No coding
              experience needed to get started.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryLink} href="/templates/">Build with a template <ArrowRightIcon /></Link>
              <a className={styles.secondaryLink} href="#products">Explore our products <ArrowRightIcon /></a>
            </div>
          </div>
          <figure className={styles.introVideo}>
            <video
              controls
              playsInline
              preload="none"
              poster="/videos/runsit-intro-poster.jpg"
              width={1920}
              height={1080}
              aria-label="Watch the runsIT introduction"
              aria-describedby="intro-video-description"
            >
              <source src="/videos/runsit-intro.mp4" type="video/mp4" />
              Your browser doesn’t support embedded video. <a href="/videos/runsit-intro.mp4">Watch the runsIT introduction</a>.
            </video>
            <figcaption><span>A quick look at what you can build.</span><span>22 seconds</span></figcaption>
            <details className={styles.videoDescription}>
              <summary>Read video description</summary>
              <p id="intro-video-description">A short tour of runsIT’s apps and games: Neutronium, PulseDeals, The Last Echo, Local Lore and Build Your Room. An example shows choosing a browser game template, personalizing it as “City Quest,” then copying the purchased prompt into an AI tool. The video ends with “Our foundations. Your next idea.” Music and interface sounds play throughout; there is no spoken narration.</p>
            </details>
          </figure>
        </section>

        <section className={styles.products} id="products" aria-labelledby="products-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>01 / Our products</p>
              <h2 id="products-heading">Made by us. Ready for you.</h2>
            </div>
            <p>Explore the products, then find a template to make something of your own.</p>
          </div>
          <div className={styles.productGrid}>
            {products.map((product) => {
              const template = templateCatalog.find((item) => templateDemos[item.id].some((demo) => demo.name === product.name));
              return <article
                key={product.id}
                className={`${styles.productCard} ${styles[product.id]}`}
              >
                <a href={product.href} className={styles.productMainLink} aria-label={product.action}>
                <div className={styles.productArtwork} aria-hidden="true">
                  {product.id === "the-last-echo" ? (
                    <span className={styles.gameTitle}>THE LAST<br /><strong>ECHO</strong></span>
                  ) : (
                    <Image
                      src={product.artwork}
                      alt=""
                      width={product.id === "build-your-room" ? 1920 : 1536}
                      height={product.id === "build-your-room" ? 1080 : 1024}
                      className={styles.productImage}
                      unoptimized
                    />
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
                {template && <Link className={styles.productTemplateLink} href={`/templates/#${template.id}`}>
                  <span>Make your own with the {template.title.toLowerCase()} template</span><ArrowRightIcon />
                </Link>}
              </article>;
            })}
          </div>
        </section>

        <section className={styles.templates} id="templates" aria-labelledby="templates-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>02 / Build your own</p>
              <h2 id="templates-heading">Our foundations. Your next idea.</h2>
            </div>
            <Link className={styles.secondaryLink} href="/templates/">Browse all templates <ArrowRightIcon /></Link>
          </div>
          <div className={styles.templateIntro}>
            <p>Start with a detailed AI prompt based on the structure behind our products. Describe your idea in your own words, then let your AI guide you through building and running it.</p>
            <p>No coding experience needed to get started. Each template covers setup, service connections, testing and upkeep, plus a file of follow-up prompts for what to do next.</p>
          </div>
          <div className={styles.templateGrid}>{templateCatalog.map((template, index) => (
            <Link key={template.id} className={styles.templateCard} href={`/templates/#${template.id}`}>
              <span className={styles.templateNumber}>0{index + 1} / AI build template</span>
              <h3>{template.title}</h3>
              <p>{template.description}</p>
              <span className={styles.templateAction}>Make it yours <ArrowRightIcon /></span>
            </Link>
          ))}</div>
          <p className={styles.templateNote}>Copy the prompt into your AI tool. Choose guided manual steps or computer control with a compatible AI. You own the app you build and use your own accounts; AI tools and hosting are separate.</p>
          <Link className={styles.builderTeaser} href="/templates/#prompt-builder">
            <div><span className={styles.builderLabel}>Prompt builder · Coming soon</span><h3>Love making apps?</h3><p>More creative freedom. More prompts for your next idea.</p></div>
            <span className={styles.builderAction}>Check out this tool <ArrowRightIcon /></span>
          </Link>
        </section>

        <section className={styles.founders} id="founders" aria-labelledby="founders-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>03 / The founders</p>
              <h2 id="founders-heading">The people behind runsIT.</h2>
            </div>
            <p>Three founders building products and helping you start your own.</p>
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
            <h2 id="contact-heading">A product question or a different idea?</h2>
            <p className={styles.contactDescription}>Ask about our products or tell us the custom template you need.</p>
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
