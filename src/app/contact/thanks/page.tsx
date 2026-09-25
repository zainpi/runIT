import type { Metadata } from "next";
import Link from "next/link";
import { MenuBar, Taskbar } from "@/components/runsos/MenuBar";
import { Window } from "@/components/runsos/Window";
import { ArrowIcon } from "@/components/runsos/icons";
import os from "@/components/runsos/os.module.css";
import { site } from "@/lib/site";
import styles from "../../content-page.module.css";

export const metadata: Metadata = {
  title: "Message sent",
  description: "Thanks for contacting runsIT. Your message has been sent.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/contact/thanks/" },
};

export default function ContactThanksPage() {
  return (
    <div className={os.root} data-os>
      <MenuBar />
      <main id="main" className={`${os.container} ${styles.page}`}>
        <Window as="section" title="message-sent.txt" tone="#7fd8c3" labelledBy="thanks-heading">
          <div className={styles.windowBody}>
            <p className={`${os.pixel} ${styles.kicker}`}>Message sent</p>
            <h1 id="thanks-heading">Thanks. We’ve got your message.</h1>
            <p className={styles.lead}>
              We’ll reply to the email address you gave us. If you need to add something, email <a href={`mailto:${site.email}`}>{site.email}</a> and mention your earlier message.
            </p>
            <div className={styles.actions}>
              <Link className={os.button} href="/">Back to the desktop <ArrowIcon /></Link>
              <Link className={`${os.button} ${os.buttonLight}`} href="/templates/">Browse AI templates</Link>
            </div>
          </div>
        </Window>
      </main>
      <Taskbar />
    </div>
  );
}
