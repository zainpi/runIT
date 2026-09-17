import { site } from "@/lib/site";
import styles from "./prompt-builder-offer.module.css";

export function PromptBuilderOffer() {
  const contactUrl = `mailto:${site.email}?subject=${encodeURIComponent("Prompt builder access")}&body=${encodeURIComponent("Hi runsIT, I’m interested in the upcoming prompt builder. Please share more about access.")}`;

  return (
    <section id="prompt-builder" className={styles.offer} aria-labelledby="prompt-builder-heading">
      <div className={styles.intro}>
        <div className={styles.heading}>
          <h2 id="prompt-builder-heading">Prompt builder</h2>
          <span className={styles.status}>Coming soon</span>
        </div>
        <p className={styles.description}>Shape your next app idea into a prompt.</p>
      </div>
      <a className={styles.action} href={contactUrl}>Ask about access <span aria-hidden="true">↗</span></a>
    </section>
  );
}
