import { formatPrice, type TemplateCurrency } from "@/lib/templates/catalog";
import { site } from "@/lib/site";
import styles from "./prompt-builder-offer.module.css";

const PRICE_CENTS = 1699;

export function PromptBuilderOffer({ currency }: { currency: TemplateCurrency }) {
  const price = `${formatPrice(PRICE_CENTS, currency)} ${currency.toUpperCase()}`;
  const contactUrl = `mailto:${site.email}?subject=${encodeURIComponent("Prompt builder access")}&body=${encodeURIComponent(`Hi runsIT, I’m interested in the prompt builder at ${price} every 2 weeks. Please share more about access and what’s included.`)}`;

  return (
    <section id="prompt-builder" className={styles.offer} aria-labelledby="prompt-builder-heading">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>For your next idea. And the one after that.</p>
        <h2 id="prompt-builder-heading">Love making apps?<br /><span>Meet your prompt builder.</span></h2>
        <p className={styles.description}>More creative freedom. More prompts to make your ideas happen. Our upcoming prompt builder is for people who always have something new they want to build.</p>
        <ul className={styles.benefits} aria-label="Planned prompt builder features">
          <li><strong>Explore more directions</strong><span>Try different concepts, styles and feature combinations for your app.</span></li>
          <li><strong>Keep the ideas coming</strong><span>Create prompts for more projects and new takes on your favourites.</span></li>
          <li><strong>Make every prompt yours</strong><span>Shape the details around what you want to build, then take your prompt into your AI tool.</span></li>
        </ul>
      </div>
      <div className={styles.plan}>
        <span className={styles.status}>Coming soon</span>
        <h3>Prompt builder</h3>
        <p className={styles.price}><strong>{formatPrice(PRICE_CENTS, currency)}</strong> <span>{currency.toUpperCase()}</span></p>
        <p className={styles.cadence}>every 2 weeks</p>
        <p className={styles.terms}>Planned subscription price. Billed every 14 days when subscriptions launch.</p>
        <a className={styles.action} href={contactUrl}>Ask about access <span aria-hidden="true">↗</span></a>
        <p className={styles.note}>This is a preview. Subscriptions aren’t open yet. AI tools and hosting are separate.</p>
      </div>
    </section>
  );
}
