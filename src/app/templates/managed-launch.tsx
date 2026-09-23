"use client";

import { useState } from "react";
import { type TemplateId, templateCatalog } from "@/lib/templates/catalog";
import { site } from "@/lib/site";
import styles from "./managed-launch.module.css";

type Service = "hosting" | "management" | "both";

const browserServiceLabels: Record<Service, string> = {
  hosting: "Host it for me",
  management: "Run it for me",
  both: "Host and run it",
};
const mobileServiceLabels: Record<Service, string> = {
  hosting: "Host my app’s cloud services",
  management: "Manage release and updates",
  both: "Handle both",
};

const mobileTemplates: TemplateId[] = ["mobile-app", "mobile-game"];
const supportedTemplates: TemplateId[] = [...mobileTemplates, "storefront", "browser-game"];

export function hasManagedLaunch(templateId: TemplateId): boolean {
  return supportedTemplates.includes(templateId);
}

export function ManagedLaunch({ templateId, projectName }: { templateId: TemplateId; projectName?: string }) {
  const [service, setService] = useState<Service>("both");
  const [notes, setNotes] = useState("");
  const template = templateCatalog.find((item) => item.id === templateId)!;
  const mobile = mobileTemplates.includes(templateId);
  const serviceLabels = mobile ? mobileServiceLabels : browserServiceLabels;
  const name = projectName?.replace(/[\r\n]+/g, " ").trim().slice(0, 100) || `My ${template.title.toLowerCase()}`;
  const subject = `Launch help request: ${name}`;
  const body = [
    "Hi runsIT,",
    "",
    `I'd like help with: ${serviceLabels[service]}`,
    `Project: ${name}`,
    `Template: ${template.title}`,
    mobile ? "Platform: Mobile app/game (cloud services and store release as needed)" : "Platform: Browser/online project",
    notes.trim() ? `What I need help with: ${notes.trim()}` : "Please tell me what you need from me to scope this.",
    "",
    "Please send me a quote for setup, ongoing management, and any third-party costs before starting work.",
  ].join("\n");
  const requestHref = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return <section id="managed-launch" className={styles.card} aria-labelledby="managed-launch-title">
    <div className={styles.intro}>
      <p className={styles.eyebrow}>Want a hand with launch?</p>
      <h2 id="managed-launch-title">We can host it or run it for you.</h2>
      <p>{mobile
        ? "We can set up and host your app’s backend, database and other cloud services, then help with store release and ongoing operations."
        : "We can put your browser project online, connect a domain, and take care of updates, monitoring and backups."}</p>
      <p className={styles.price}>One-time setup and ongoing service are quoted separately. Provider and app-store fees, if needed, are identified before you approve anything.</p>
    </div>
    <div className={styles.request}>
      <fieldset>
        <legend>What would you like us to handle?</legend>
        {(Object.keys(serviceLabels) as Service[]).map((value) => <label key={value} className={service === value ? styles.selected : ""}>
          <input type="radio" name={`managed-service-${templateId}`} value={value} checked={service === value} onChange={() => setService(value)} />
          <span>{serviceLabels[value]}</span>
        </label>)}
      </fieldset>
      <label className={styles.noteLabel} htmlFor={`launch-notes-${templateId}`}>Anything we should know? <span>Optional</span></label>
      <textarea id={`launch-notes-${templateId}`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} placeholder={mobile ? "e.g. Need iOS release and user accounts" : "e.g. I have a domain and need a production launch"} />
      <a className={styles.cta} href={requestHref}>Email us a request <span aria-hidden="true">↗</span></a>
      <p className={styles.hint}>Opens your email app with the details filled in. Review before sending. If it doesn’t open, email <a href={`mailto:${site.email}`}>{site.email}</a>. Don’t include passwords or private access links.</p>
    </div>
  </section>;
}
