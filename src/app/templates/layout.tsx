import Link from "next/link";
import { site } from "@/lib/site";
import styles from "./templates.module.css";
import { MetaPixel } from "./meta-pixel";
export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.container}>
      <Link href="/" className={styles.wordmark} aria-label="runsIT home">runs<span>IT</span><b>.</b></Link>
      <nav aria-label="Primary"><Link href="/#products">Products</Link><Link href="/templates/">AI templates</Link><Link href="/templates/library/">My templates</Link></nav>
      <a className={styles.contactLink} href={`mailto:${site.email}`}>Say hello ↗</a>
    </div></header>
    <main id="main" className={styles.container}>{children}</main>
    <footer className={styles.footer}><div className={styles.container}><span>runsIT · Made with care in Canada.</span><a href={`mailto:${site.email}`}>{site.email} ↗</a></div></footer>
    <MetaPixel />
  </div>;
}
