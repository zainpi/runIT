import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { company, founders, products, xProfileUrl, type ProductId } from "@/lib/company";
import { site } from "@/lib/site";
import { organizationId } from "@/lib/structured-data";
import { AI_MESSAGE_LIMIT } from "@/lib/templates/ai-contract";
import { templateCatalog } from "@/lib/templates/catalog";
import { templateDemos } from "@/lib/templates/demos";
import { TRIAL_MESSAGE_LIMIT } from "@/lib/templates/trial-contract";
import { alt as socialImageAlt, size as socialImageSize } from "../opengraph-image";
import home from "../home.module.css";
import styles from "./about.module.css";

const title = "About runsIT — Independent Canadian software company";
const description =
  "runsIT is an independent Canadian software company building apps, games and business tools, plus AI templates for building your own. Meet the founders.";
const pageUrl = `${site.url}/about/`;
// A page-level openGraph object replaces the root one, so reuse the site share image explicitly.
const socialImage = { url: "/opengraph-image/", ...socialImageSize, alt: socialImageAlt };

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/about/" },
  openGraph: { type: "website", url: "/about/", siteName: site.name, title, description, locale: "en_CA", images: [socialImage] },
  twitter: { card: "summary_large_image", title, description, images: [socialImage] },
};

const listFormat = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });
const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const inWords = (count: number) => numberWords[count] ?? String(count);
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// About-page copy for each product. Typed by product ID so a new product needs its own entry.
const productDetails: Record<ProductId, { platform: string; status?: string; body: string[]; linkLabel?: string }> = {
  pulsedeals: {
    platform: "iPhone app · Shopping",
    body: [
      "PulseDeals is an iPhone app with a live feed of Amazon price drops, plus price context, saved deals and alert preferences.",
      "It’s built for shoppers who want to spot a worthwhile discount without tracking prices by hand. Access is a subscription billed through Apple.",
    ],
  },
  "the-last-echo": {
    platform: "Mobile game · iOS",
    status: "On the App Store · Android coming soon",
    body: [
      "The Last Echo is an idle auto-battle RPG: your party keeps fighting while you’re away, and you choose the gear, skills and upgrades.",
      "It’s built for players who like RPG decisions without constant check-ins. Odds are published, pity is visible, and free players can clear the core game.",
    ],
  },
  "local-lore": {
    platform: "Browser game · Free to play",
    body: [
      "Local Lore is a geography game played in your browser. You look at real Street View photos and drop a pin where you think each one was taken.",
      "It’s built for people who want to know Toronto, New York City, Vancouver or London a little better, with three-round sets and a daily challenge for each city.",
    ],
  },
  "build-your-room": {
    platform: "Roblox game",
    body: [
      "Build Your Room is a Roblox game where you design a bedroom that feels like you, collect furniture and visit your friends’ rooms.",
      "It’s built for Roblox players who enjoy decorating and sharing what they make.",
    ],
    linkLabel: "Play Build Your Room on Roblox",
  },
  neutronium: {
    platform: "Business software · Company IT",
    body: [
      "Neutronium is a workspace for company IT that brings employee onboarding, access and offboarding into one place.",
      "It’s built for the people who set up new hires and manage who can use which tools. Keeping those steps together leaves a clear trail of access decisions.",
    ],
  },
};

// Templates whose public demo is one of our own products.
const templatePairs = templateCatalog.flatMap((template) => {
  const product = products.find((item) => templateDemos[template.id].some((demo) => demo.name === item.name));
  return product ? [{ template, product }] : [];
});
const templateNames = listFormat.format(templateCatalog.map((template) => template.title));
const founderNames = listFormat.format(founders.map((founder) => founder.name));
const reviewedOn = new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${company.factsReviewed}T00:00:00Z`));

const differentiators = [
  {
    title: "We make our own products",
    body: `runsIT isn’t only a template shop. Our ${inWords(products.length)} products cover an iPhone app, an iOS game, a browser game, a Roblox game and business software for company IT, and each has its own page where you can see the work for yourself.`,
  },
  {
    title: "Templates that share our products’ foundations",
    body: `Our AI templates share the foundations behind our products, so you aren’t starting from a blank page. ${capitalized(inWords(templatePairs.length))} of the ${inWords(templateCatalog.length)} are paired with the product they’re based on, so you can see a finished example first:`,
    pairs: true,
  },
  {
    title: "Guidance past the first build",
    body: `Each template covers setup, service connections, testing and upkeep, not only the first version, and includes a file of follow-up prompts for what to do next. Every order also includes ${AI_MESSAGE_LIMIT} AI editing messages for refining your plan before you create your build guide.`,
  },
  {
    title: "Your tools and your accounts",
    body: "You build with the AI tool you choose, on accounts you set up for hosting and other services. Follow guided manual steps or let a compatible AI control your computer; third-party costs are billed by those providers, not bundled into our price.",
  },
  {
    title: "Founders you can look up",
    body: `runsIT is run by ${inWords(founders.length)} named co-founders, each with a portfolio page on this site. One address, ${site.email}, covers product support, template questions and custom template requests.`,
  },
];

const faqs = [
  {
    question: "What is runsIT?",
    answer: `runsIT is an independent software company based in ${company.country}. We build our own apps, games and business software, and we create AI build templates based on the foundations behind those products.`,
  },
  {
    question: "What products does runsIT build?",
    answer: "PulseDeals, an iPhone app for Amazon price drops; The Last Echo, an idle RPG on iOS; Local Lore, a free browser geography game; Build Your Room, a Roblox game; and Neutronium, a workspace for company IT onboarding and access. Each product page links to its own terms and support where they’re published.",
  },
  {
    question: "Who founded runsIT?",
    answer: `runsIT was founded by ${founderNames}. All ${inWords(founders.length)} are co-founders, and each has a portfolio page on this site.`,
  },
  {
    question: "What are runsIT’s AI templates?",
    answer: `They’re detailed AI build prompts for ${inWords(templateCatalog.length)} kinds of project: ${templateNames}. You describe your idea, refine an AI-generated plan, then download a build guide with a clickable prototype and a prompt for your coding AI.`,
  },
  {
    question: "Do I need coding experience to use a template?",
    answer: "No coding experience is needed to get started. The build guide explains setup, service connections, testing and upkeep in simple steps, and your AI tool writes the code. You still make the decisions, create the accounts and test the result.",
  },
  {
    question: "What’s included, and what costs extra?",
    answer: `Each template includes its build prompt, an AI overview and one complete build guide, and every order includes ${AI_MESSAGE_LIMIT} AI editing messages. Optional extras are one-time add-ons. Your coding AI, hosting and other third-party services are separate and may have their own costs; current prices are on the AI templates page.`,
  },
  {
    question: "Can I request a custom template?",
    answer: `Yes. Email ${site.email} with the app or game you’d like a template for and what it should do. Custom templates aren’t sold through the store, so there’s no published price or timeline for them.`,
  },
  {
    question: "How do I contact the team?",
    answer: `Email ${site.email}. For help with a product, include the product name, your device and what happened, and never send passwords, payment details or private access links.`,
  },
];

const aboutPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${pageUrl}#webpage`,
  url: pageUrl,
  name: "About runsIT",
  description,
  inLanguage: "en-CA",
  dateModified: company.factsReviewed,
  about: { "@id": organizationId },
  mainEntity: { "@id": organizationId },
};

function Wordmark() {
  return (
    <Link href="/" className={home.wordmark} aria-label="runsIT home">
      runs<span>IT</span><span className={home.wordmarkDot}>.</span>
    </Link>
  );
}

function SectionHeading({ id, label, title, intro }: { id: string; label: string; title: string; intro?: string }) {
  return (
    <div className={home.sectionHeading}>
      <div>
        <p className={home.sectionLabel}>{label}</p>
        <h2 id={id}>{title}</h2>
      </div>
      {intro && <p>{intro}</p>}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className={`${home.home} ${styles.about}`}>
      <header className={home.header}>
        <div className={`${home.container} ${home.headerInner}`}>
          <Wordmark />
          <nav className={home.nav} aria-label="Primary">
            <Link href="/#products">Products</Link>
            <Link href="/templates/">AI templates</Link>
            <Link href="/about/" aria-current="page">About us</Link>
          </nav>
          <a className={home.headerContact} href={`mailto:${site.email}`}>
            Say hello <ArrowRightIcon />
          </a>
        </div>
      </header>

      <main id="main" className={home.container}>
        <section className={`${home.hero} ${styles.hero}`} id="about" aria-labelledby="about-heading">
          <p className={home.eyebrow}><span /> Our company. Built in {company.country}.</p>
          <h1 id="about-heading">About <span>runsIT</span></h1>
          <div className={home.heroBottom}>
            <div className={styles.heroText}>
              <p className={styles.lead}>
                runsIT is an independent Canadian software company that builds apps, games and business tools, and creates AI templates for people who want to build their own.
              </p>
              <p className={home.intro}>
                We make things you can use today: a deals app for iPhone, three games and an IT workspace for companies. Our AI templates share the foundations behind those products, so you can describe your own idea and follow step-by-step guidance to build it with an AI tool. No coding experience is needed to get started.
              </p>
            </div>
            <div className={home.heroActions}>
              <Link className={home.primaryLink} href="/templates/">Browse AI templates <ArrowRightIcon /></Link>
              <a className={home.secondaryLink} href="#products">Explore our products <ArrowRightIcon /></a>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="what-heading">
          <SectionHeading
            id="what-heading"
            label="01 / What we make"
            title="What runsIT does"
            intro={`${capitalized(inWords(products.length))} products we build ourselves, and AI templates based on them.`}
          />
          <p className={styles.groupLabel} id="products">Our products</p>
          <ul className={styles.productList} role="list" aria-label="runsIT products">
            {products.map((product) => {
              const details = productDetails[product.id];
              const template = templatePairs.find((pair) => pair.product.id === product.id)?.template;
              return (
                <li key={product.id} id={product.id} className={styles.productRow}>
                  <div>
                    <p className={styles.platform}>{details.platform}</p>
                    <h3>{product.name}</h3>
                    {details.status && <p className={styles.status}>{details.status}</p>}
                  </div>
                  <div className={styles.productBody}>
                    {details.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    <div className={styles.productLinks}>
                      <a className={styles.textLink} href={product.href}>{details.linkLabel ?? product.action} <ArrowRightIcon /></a>
                      {template && (
                        <Link className={styles.quietLink} href={`/templates/#${template.id}`}>
                          Make your own with the {template.title} template
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className={styles.templatesBlock} id="ai-templates">
            <div>
              <p className={styles.platform}>Build your own</p>
              <h3>AI templates</h3>
              <p>
                {capitalized(inWords(templateCatalog.length))} AI build templates share the foundations behind our products. You describe your idea, refine an AI-generated plan, then download a build guide with a clickable prototype and a detailed prompt for your coding AI.
              </p>
              <p>
                They’re built for people making their first app with AI and for independent creators who want a structured start. No coding experience is needed to get started.
              </p>
              <Link className={styles.textLink} href="/templates/">Browse AI templates <ArrowRightIcon /></Link>
            </div>
            <div>
              <ul className={styles.templateList} role="list" aria-label="AI build templates">
                {templateCatalog.map((template) => (
                  <li key={template.id}>
                    <Link className={styles.templateLink} href={`/templates/#${template.id}`}>
                      <span>{template.title}</span>{" "}
                      <small>{template.category}</small>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className={styles.comingSoon}>
                <span>Coming soon</span> Prompt builder: a tool for shaping new app ideas into prompts.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="different-heading">
          <SectionHeading id="different-heading" label="02 / Our approach" title="What makes runsIT different" />
          <ol className={styles.differences} role="list">
            {differentiators.map((item, index) => (
              <li key={item.title}>
                <span className={styles.number} aria-hidden="true">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {item.pairs && (
                  <ul className={styles.pairList} role="list" aria-label="Templates and the products they share foundations with">
                    {templatePairs.map(({ template, product }) => (
                      <li key={template.id}>
                        <Link href={`/templates/#${template.id}`}>{template.title} template</Link>
                        <span aria-hidden="true">·</span>
                        <a href={product.href}>{product.name}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="who-heading">
          <SectionHeading
            id="who-heading"
            label="03 / Who it’s for"
            title="Who uses runsIT"
            intro="Each offering is designed with a specific kind of person in mind."
          />
          <ul className={styles.audiences} role="list">
            <li><strong>Built for first-time app builders using AI.</strong> <Link href="/templates/">AI templates</Link> give you a plan, simple steps and prompts, with no coding experience needed to get started.</li>
            <li><strong>Built for independent creators.</strong> Templates cover mobile apps, mobile and browser games, Roblox games, Discord bots and online stores.</li>
            <li><strong>Built for teams that manage employee IT.</strong> <a href="#neutronium">Neutronium</a> keeps onboarding, access and offboarding in one place.</li>
            <li><strong>Built for shoppers watching for price drops.</strong> <a href="#pulsedeals">PulseDeals</a> brings Amazon deals to a live feed on iPhone.</li>
            <li><strong>Built for players.</strong> <a href="#the-last-echo">The Last Echo</a> for idle RPG fans, <a href="#local-lore">Local Lore</a> for anyone who wants to know their city, and <a href="#build-your-room">Build Your Room</a> for Roblox players who like to decorate.</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="team-heading">
          <SectionHeading
            id="team-heading"
            label="04 / The founders"
            title="The team behind runsIT"
            intro={`${capitalized(inWords(founders.length))} co-founders building the products on this page and the templates based on them.`}
          />
          <ul className={`${home.founderGrid} ${styles.founderList}`} role="list">
            {founders.map((founder) => (
              <li key={founder.id} className={home.founderCard}>
                <span className={home.founderNumber} aria-hidden="true">{founder.id}</span>
                <div className={home.founderAvatar} aria-hidden="true">
                  {founder.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
                </div>
                <h3>{founder.name}</h3>
                <p>{founder.role}, runsIT</p>
                {founder.x && <a className={styles.socialLink} href={xProfileUrl(founder.x)} rel="noopener">@{founder.x} on X</a>}
                <Link className={home.portfolioLink} href={founder.portfolioUrl}>
                  View {founder.name}’s portfolio <ArrowRightIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="how-heading">
          <SectionHeading id="how-heading" label="05 / Getting started" title="How runsIT works" />
          <div className={styles.howGrid}>
            <div className={styles.howItem}>
              <h3>Explore or use a product</h3>
              <div className={styles.howBody}>
                <p>
                  Start from the <a href="#products">product’s own page</a>. PulseDeals runs on iPhone, The Last Echo on iOS, Local Lore in your browser, Build Your Room on Roblox, and Neutronium on the web, where a company can sign in or create a workspace.
                </p>
                <p>Pricing, terms and support differ by product and are published with each one:</p>
                <ul className={styles.linkList} role="list">
                  <li><a href="/pulsedeals/terms.html">PulseDeals terms of use</a> · <a href="/pulsedeals/support.html">PulseDeals support</a></li>
                  <li><a href="/the-last-echo/terms.html">The Last Echo terms of service</a> · <a href="/the-last-echo/support.html">The Last Echo support</a></li>
                  <li><a href="/local-lore/terms.html">Local Lore terms</a></li>
                </ul>
              </div>
            </div>

            <div className={`${styles.howItem} ${styles.howTemplates}`}>
              <h3>Choose and use an AI template</h3>
              <div className={styles.howBody}>
                <ol className={styles.steps}>
                  <li>Choose one or more templates on the <Link href="/templates/">AI templates page</Link> and pay once through Stripe checkout.</li>
                  <li>Save your private link, describe your idea and review the AI-generated plan. Refine it with your included editing messages.</li>
                  <li>Create your build guide: one HTML file with simple steps, official resources, a detailed specification and a clickable prototype that uses sample data.</li>
                  <li>Paste the prompt into your coding AI to build and test your app, following guided manual steps or letting a compatible AI control your computer.</li>
                </ol>
                <div className={styles.includes}>
                  <div>
                    <h4>Your purchase includes</h4>
                    <ul>
                      <li>A build prompt, an AI overview and one complete build guide for each template</li>
                      <li>{AI_MESSAGE_LIMIT} AI editing messages shared across your order</li>
                      <li>Optional extras, if you keep them in your order: an app icon, an AI teamwork prompt or a skills and tools setup guide, each charged once</li>
                    </ul>
                  </div>
                  <div>
                    <h4>You supply or pay for separately</h4>
                    <ul>
                      <li>Your idea, your decisions and time to test what your AI builds</li>
                      <li>Your coding AI tool or subscription</li>
                      <li>Hosting, domains and other third-party services, on your own accounts</li>
                      <li>App store developer fees, if you publish a mobile app or game</li>
                    </ul>
                  </div>
                </div>
                <p>
                  A template is a guided starting point, not a managed development service: you and your AI tool build the app. If you’d like a hand launching a mobile app, mobile game, online store or browser game, you can request a separate quote for hosting or ongoing management from your template library. With a free-trial code, you can try a personalized plan with {TRIAL_MESSAGE_LIMIT} AI edits before buying.
                </p>
                <p className={styles.inlineLinks}>
                  <Link className={styles.textLink} href="/templates/">See templates and prices <ArrowRightIcon /></Link>
                  <Link className={styles.quietLink} href="/templates/library/">Already purchased? Open my templates</Link>
                </p>
              </div>
            </div>

            <div className={styles.howItem}>
              <h3>Contact the team</h3>
              <div className={styles.howBody}>
                <p>
                  Email <a href={`mailto:${site.email}`}>{site.email}</a> about a product, a template order or a custom template you’d like us to make.
                </p>
                <p>
                  For product help, include the product name, your device and what happened. Never send passwords, payment details or private access links.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="facts-heading">
          <SectionHeading id="facts-heading" label="06 / At a glance" title="Key facts" />
          <dl className={styles.facts}>
            <div><dt>Company name</dt><dd>{site.name}</dd></div>
            <div><dt>Type</dt><dd>{company.type}</dd></div>
            <div><dt>Based in</dt><dd>{company.country}</dd></div>
            <div>
              <dt>Founders</dt>
              <dd>
                <ul className={styles.inlineList} role="list">
                  {founders.map((founder) => <li key={founder.id}><Link href={founder.portfolioUrl}>{founder.name}</Link></li>)}
                </ul>
              </dd>
            </div>
            <div><dt>Website</dt><dd><a href={site.url}>{new URL(site.url).hostname}</a></dd></div>
            <div><dt>Core offering</dt><dd>Apps, games and business software, plus AI build templates</dd></div>
            <div>
              <dt>Products</dt>
              <dd>
                <ul className={styles.inlineList} role="list">
                  {products.map((product) => <li key={product.id}><a href={product.href}>{product.name}</a></li>)}
                </ul>
              </dd>
            </div>
            <div>
              <dt>AI templates</dt>
              <dd>{capitalized(inWords(templateCatalog.length))}: {templateNames} (<Link href="/templates/">browse templates</Link>)</dd>
            </div>
            <div>
              <dt>Pricing</dt>
              <dd>
                Varies by offering. See <Link href="/templates/">AI template prices</Link> and the <a href="/pulsedeals/terms.html">PulseDeals subscription terms</a>. Local Lore is free to play.
              </dd>
            </div>
            <div><dt>Contact</dt><dd><a href={`mailto:${site.email}`}>{site.email}</a></dd></div>
          </dl>
          <p className={styles.reviewed}>Facts last reviewed <time dateTime={company.factsReviewed}>{reviewedOn}</time>.</p>
        </section>

        <section className={styles.section} aria-labelledby="faq-heading">
          <SectionHeading id="faq-heading" label="07 / Questions" title="Frequently asked questions" />
          <div className={styles.faqs}>
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${home.contact} ${styles.cta}`} aria-label="Next steps">
          <div>
            <p className={home.sectionLabel}>Get started</p>
            <p className={styles.ctaTitle}>Explore what we’ve made, or build your own.</p>
            <p className={home.contactDescription}>A question about a product, or a template you’d like to see? Send us an email.</p>
          </div>
          <div className={styles.ctaLinks}>
            <a className={home.secondaryLink} href="#products">Explore our products <ArrowRightIcon /></a>
            <Link className={home.primaryLink} href="/templates/">Browse AI templates <ArrowRightIcon /></Link>
            <a className={styles.textLink} href={`mailto:${site.email}`}>{site.email} <ArrowRightIcon /></a>
          </div>
        </section>
      </main>

      <footer className={home.footer}>
        <div className={`${home.container} ${home.footerInner}`}>
          <Wordmark />
          <p>© {new Date().getFullYear()} runsIT. Built with care in {company.country}.</p>
          <a href="#about">Back to top ↑</a>
        </div>
      </footer>

      <JsonLd data={aboutPageJsonLd} />
    </div>
  );
}
