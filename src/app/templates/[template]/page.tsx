import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Window } from "@/components/runsos/Window";
import { site, siteOpenGraph } from "@/lib/site";
import { templatesSocialImage } from "@/lib/social";
import { faqJsonLd, organizationId, websiteId } from "@/lib/structured-data";
import { FIRST_TEMPLATE_CENTS, formatPrice, templateCatalog } from "@/lib/templates/catalog";
import { templateDemos } from "@/lib/templates/demos";
import { templateBuyingQuestions, templatePagePath, templatePages } from "@/lib/templates/public-content";
import { requestTemplateCurrency } from "@/lib/templates/request-currency";
import os from "@/components/runsos/os.module.css";
import styles from "./template.module.css";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ template: string }> };

async function getTemplate(params: PageProps["params"]) {
  const { template: id } = await params;
  const template = templateCatalog.find((item) => item.id === id);
  if (!template) notFound();
  return template;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const template = await getTemplate(params);
  const { title, description } = templatePages[template.id];
  const url = templatePagePath(template.id);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...siteOpenGraph, title: `${title} | ${site.name}`, description, url, images: [templatesSocialImage] },
    twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [templatesSocialImage] },
  };
}

export default async function TemplatePage({ params }: PageProps) {
  const template = await getTemplate(params);
  const content = templatePages[template.id];
  const currency = await requestTemplateCurrency();
  const pageUrl = `${site.url}${templatePagePath(template.id)}`;
  const purchasePath = `/templates/#${template.id}`;
  const demos = templateDemos[template.id];
  const questions = [{ question: content.planningQuestion, answer: content.planningAnswer }, ...templateBuyingQuestions(currency)];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage", "@id": `${pageUrl}#webpage`, url: pageUrl,
        name: content.title, description: content.description, inLanguage: "en-CA",
        isPartOf: { "@id": websiteId }, publisher: { "@id": organizationId },
        mainEntity: { "@id": `${pageUrl}#product` }, breadcrumb: { "@id": `${pageUrl}#breadcrumbs` },
      },
      {
        "@type": "Product", "@id": `${pageUrl}#product`,
        name: `${template.title} AI build template`, description: content.introduction,
        url: pageUrl, category: "AI build templates", brand: { "@type": "Brand", name: site.name },
        offers: {
          "@type": "Offer", url: `${currency === "usd" ? "https://runs-it.com" : site.url}${purchasePath}`,
          price: (FIRST_TEMPLATE_CENTS / 100).toFixed(2), priceCurrency: currency.toUpperCase(),
          seller: { "@id": organizationId },
        },
      },
      {
        "@type": "BreadcrumbList", "@id": `${pageUrl}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.name, item: `${site.url}/` },
          { "@type": "ListItem", position: 2, name: "AI templates", item: `${site.url}/templates/` },
          { "@type": "ListItem", position: 3, name: template.title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <article className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/">runsIT</Link><span aria-hidden="true">/</span>
        <Link href="/templates/">AI templates</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{template.title}</span>
      </nav>
      <Window title={`${template.id}.txt`} tone="#ffd23f" labelledBy="template-heading">
        <div className={styles.hero}>
          <p className={styles.kicker}>runsIT AI build templates</p>
          <h1 id="template-heading">{template.title} AI template</h1>
          <p className={styles.lead}>{content.introduction}</p>
          <p className={styles.price}><strong>{formatPrice(FIRST_TEMPLATE_CENTS, currency)} {currency.toUpperCase()}</strong> for your first template · One-time purchase</p>
          <div className={styles.actions}>
            <Link className={os.button} href={purchasePath}>Choose this template →</Link>
            <Link className={`${os.button} ${os.buttonLight}`} href="/templates/#free-trial">Use a free-trial code</Link>
          </div>
          <p className={styles.note}>Build with your own coding AI and service accounts. Hosting and third-party tools are separate.</p>
        </div>
      </Window>
      <section className={styles.section} aria-labelledby="use-cases-heading">
        <h2 id="use-cases-heading">What can you build with this template?</h2>
        <div className={styles.cards}>
          {content.useCases.map((useCase) => <div className={styles.card} key={useCase.title}><h3>{useCase.title}</h3><p>{useCase.description}</p></div>)}
        </div>
      </section>
      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="covers-heading">
          <h2 id="covers-heading">What the build prompt covers</h2>
          <ul>{template.includes.map((item) => <li key={item}>{item}</li>)}</ul>
          <p><strong>Tools in this foundation:</strong> {template.stack}</p>
          <p>The prompt guides implementation. You review the code and test the app before launch.</p>
        </section>
        <section className={styles.card} aria-labelledby="example-heading">
          <h2 id="example-heading">{demos.length ? "See a published example" : "Make the bot your own"}</h2>
          {demos.length ? <>
            <p>Explore an example behind this foundation before choosing your own features.</p>
            <ul>{demos.map((demo) => <li key={demo.url}><a href={demo.url}>Explore {demo.name} ↗</a></li>)}</ul>
            <p>Your template guides a new project with your own idea and accounts.</p>
          </> : <p>There is no public demo for this template. Start by describing your community, commands and data sources in your plan.</p>}
          <p>Made by <Link href="/about/">runsIT, an independent Canadian software company</Link>.</p>
        </section>
      </div>
      <section className={styles.section} aria-labelledby="steps-heading">
        <h2 id="steps-heading">How to go from an idea to a build</h2>
        <ol className={styles.steps}>
          <li><strong>Choose and personalize.</strong> Select the template in the store and pay once, then describe the project you want to make.</li>
          <li><strong>Refine the plan.</strong> Review the AI overview and use your included editing messages to make the plan fit your idea.</li>
          <li><strong>Create your build guide.</strong> Download the HTML guide with its specification, steps, simulated prototype and build prompt.</li>
          <li><strong>Build and test with your AI.</strong> Use the prompt in your coding AI, configure your accounts, and follow the testing and launch steps.</li>
        </ol>
      </section>
      <section id="faq" className={styles.section} aria-labelledby="faq-heading">
        <h2 id="faq-heading">Questions before you start</h2>
        <div className={styles.questions}>
          {questions.map(({ question, answer }) => <div key={question}><h3>{question}</h3><p>{answer}</p></div>)}
        </div>
      </section>
      <nav className={styles.section} aria-label="Other AI templates">
        <h2>Explore the other templates</h2>
        <ul className={styles.related}>
          {templateCatalog.filter((item) => item.id !== template.id).map((item) => <li key={item.id}><Link href={templatePagePath(item.id)}>{item.title} AI template →</Link></li>)}
        </ul>
      </nav>
      <JsonLd data={structuredData} />
      <JsonLd data={faqJsonLd(pageUrl, questions)} />
    </article>
  );
}
