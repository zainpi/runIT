"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowIcon } from "@/components/runsos/icons";
import os from "@/components/runsos/os.module.css";
import { contactLimits, contactTopics, validateContact, type ContactField } from "@/lib/contact";
import { site } from "@/lib/site";
import styles from "../content-page.module.css";

type Errors = Partial<Record<ContactField, string>>;
const redirectErrors: Record<string, string> = {
  invalid: "Some details were missing or too long. Please check the form and try again.",
  unavailable: `The contact form isn’t available right now. Please email us at ${site.email}.`,
  failed: `We couldn’t send your message. Please try again, or email us at ${site.email}.`,
};

export function ContactForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);

  // A form post without JavaScript returns here with an error code.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && redirectErrors[code]) setFormError(redirectErrors[code]);
  }, []);

  useEffect(() => { if (formError) summary.current?.focus(); }, [formError]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const check = validateContact(data);
    setFormError("");
    if (!check.ok && !check.spam) {
      setErrors(check.errors);
      const first = Object.keys(check.errors)[0];
      event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const response = await fetch("/api/contact/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => ({}));
      if (response.ok) { router.push("/contact/thanks/"); return; }
      if (result.errors) setErrors(result.errors);
      setFormError(result.error || redirectErrors.failed);
    } catch {
      setFormError(redirectErrors.failed);
    }
    setSending(false);
  }

  const describedBy = (field: ContactField, hint?: string) => [hint, errors[field] ? `${field}-error` : ""].filter(Boolean).join(" ") || undefined;
  const fieldError = (field: ContactField) => errors[field] && <small id={`${field}-error`} className={styles.fieldError}>{errors[field]}</small>;

  return (
    <form id="contact-form" className={styles.form} action="/api/contact/" method="post" onSubmit={submit} noValidate aria-busy={sending}>
      {formError && (
        <div ref={summary} className={styles.formError} role="alert" tabIndex={-1}>
          {formError} {formError.includes(site.email) && <a href={`mailto:${site.email}`}>Open your email app</a>}
        </div>
      )}
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="contact-name">Your name</label>
          <input id="contact-name" name="name" autoComplete="name" maxLength={contactLimits.name} required aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("name")} />
          {fieldError("name")}
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-email">Email address</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={contactLimits.email} required aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email", "email-hint")} />
          <small id="email-hint">We’ll only use it to reply to you.</small>
          {fieldError("email")}
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-topic">What’s it about?</label>
        <select id="contact-topic" name="topic" defaultValue="" required aria-invalid={Boolean(errors.topic)} aria-describedby={describedBy("topic")}>
          <option value="" disabled>Choose a topic</option>
          {Object.entries(contactTopics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {fieldError("topic")}
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" name="message" maxLength={contactLimits.message} required aria-invalid={Boolean(errors.message)} aria-describedby={describedBy("message", "message-hint")} />
        <small id="message-hint">For product help, include the product name, your device and what happened. Please don’t send passwords, payment details or private access links.</small>
        {fieldError("message")}
      </div>
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <button className={`${os.button} ${styles.submit}`} type="submit" disabled={sending}>
          {sending ? <><span className={styles.spinner} aria-hidden="true" /> Sending…</> : <>Send message <ArrowIcon /></>}
        </button>
      </div>
      <p className={styles.privacyNote}>
        We use your details only to answer your message. See our <Link href="/privacy/">privacy policy</Link>.
      </p>
    </form>
  );
}
