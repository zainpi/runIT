import Link from "next/link";
import { MenuBar, Taskbar } from "@/components/runsos/MenuBar";
import { Window } from "@/components/runsos/Window";
import { ArrowIcon } from "@/components/runsos/icons";
import os from "@/components/runsos/os.module.css";
import styles from "./home.module.css";

export default function NotFound() {
  return (
    <div className={os.root} data-os>
      <MenuBar />
      <main id="main" className={`${os.container} ${styles.errorDesk}`}>
        <Window as="section" title="error.app" tone="#ff8a6b" labelledBy="not-found-heading" className={styles.errorWindow}>
          <div className={styles.errorBody}>
            <svg className={styles.errorIcon} width="72" height="64" viewBox="0 0 72 64" aria-hidden="true">
              <path d="M36 4 68 60H4z" fill="#ffd23f" stroke="#1b1a17" strokeWidth="3.5" strokeLinejoin="round" />
              <path d="M36 24v16" stroke="#1b1a17" strokeWidth="5" strokeLinecap="round" />
              <circle cx="36" cy="50" r="3.5" fill="#1b1a17" />
            </svg>
            <div className={styles.errorText}>
              <p className={`${os.pixel} ${styles.contactKicker}`}>Error 404 · file not found</p>
              <h1 id="not-found-heading">This page took the day off.</h1>
              <p className={styles.contactText}>The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.</p>
              <div className={styles.errorActions}>
                <Link className={os.button} href="/">Back to the desktop <ArrowIcon /></Link>
                <Link className={`${os.button} ${os.buttonLight}`} href="/templates/">Browse AI templates</Link>
              </div>
            </div>
          </div>
        </Window>
        <p className={styles.errorNote}>tip: check the link, or open a product from the desktop.</p>
      </main>
      <Taskbar backHref="/" backLabel="Back to runsIT →" />
    </div>
  );
}
