import { MenuBar, Taskbar } from "@/components/runsos/MenuBar";
import os from "@/components/runsos/os.module.css";
import { site } from "@/lib/site";
import styles from "./templates.module.css";
import { MetaPixel } from "./meta-pixel";
import { PlanLoadingProvider } from "./plan-loading";

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <div className={os.root} data-os>
    <PlanLoadingProvider>
    <MenuBar links={[
      { label: "Products", href: "/#products" },
      { label: "AI templates", href: "/templates/" },
      { label: "My templates", href: "/templates/library/" },
    ]} />
    <div className={styles.page}>
      <main id="main" className={styles.container}>{children}</main>
    </div>
    <Taskbar note="runsIT · Made with care in Canada." backHref={`mailto:${site.email}`} backLabel={`${site.email} ↗`} />
    <MetaPixel />
    </PlanLoadingProvider>
  </div>;
}
