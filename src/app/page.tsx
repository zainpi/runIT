import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Desktop } from "@/components/runsos/Desktop";
import { MenuBar, Taskbar } from "@/components/runsos/MenuBar";
import { Window } from "@/components/runsos/Window";
import { desktopApps, founderCards, templateFiles } from "@/components/runsos/apps";
import { ArrowIcon, PromptFileIcon } from "@/components/runsos/icons";
import { FIRST_TEMPLATE_CENTS, formatPrice } from "@/lib/templates/catalog";
import { site } from "@/lib/site";
import os from "@/components/runsos/os.module.css";
import styles from "./home.module.css";

export const viewport = { themeColor: "#ede4d3" };

export default function HomePage() {
  return (
    <div className={os.root} data-os>
      <MenuBar />

      <main id="main">
        <Desktop />

        <div className={`${os.container} ${styles.sections}`}>
          <Window as="section" id="products" title="Applications" tone="#ffd23f" meta={`${desktopApps.length} apps`} labelledBy="products-heading">
            <p className={os.toolbar}><span>~/runsIT/Applications</span><span>Made by us · Built in Canada</span></p>
            <div className={styles.windowBody}>
              <div className={styles.heading}>
                <h2 id="products-heading">Made by us. Ready for you.</h2>
                <p>Explore the products, then find a template to make something of your own.</p>
              </div>
              <ul className={styles.appGrid}>
                {desktopApps.map((app) => (
                  <li key={app.id} className={styles.appCard}>
                    <a className={styles.appCardMain} href={app.href}>
                      <span className={styles.appCardArt} style={{ background: app.background }}>
                        <Image src={app.image} alt="" width={app.width} height={app.height} className={styles.appCardImage} unoptimized />
                        <span className={os.chip} style={{ "--tone": app.tone } as CSSProperties}>{app.category}</span>
                      </span>
                      <div className={styles.appCardText}>
                        <span className={`${os.pixel} ${styles.fileName}`}>{app.file}</span>
                        <h3>{app.name}</h3>
                        <span className={styles.appCardDescription}>{app.description}</span>
                        <span className={styles.appCardAction}>{app.action} <ArrowIcon /></span>
                      </div>
                    </a>
                    {app.template ? (
                      <Link className={styles.appCardTemplate} href={`/templates/#${app.template.id}`}>
                        Make your own with the {app.template.title.toLowerCase()} template <ArrowIcon />
                      </Link>
                    ) : (
                      <span className={`${styles.appCardTemplate} ${styles.appCardTemplateMuted}`}>Company software, not a template</span>
                    )}
                  </li>
                ))}
                <li className={`${styles.appCard} ${styles.newApp}`}>
                  <span className={`${os.pixel} ${styles.fileName}`}>Untitled.app</span>
                  <h3>Your idea goes here.</h3>
                  <p>Pick one of our templates, describe your idea in your own words, and build it with your AI.</p>
                  <Link className={os.button} href="/templates/">Build with a template <ArrowIcon /></Link>
                </li>
              </ul>
            </div>
          </Window>

          <Window as="section" id="templates" title="Templates" tone="#ff8a6b" meta={`from ${formatPrice(FIRST_TEMPLATE_CENTS)}`} labelledBy="templates-heading" className={styles.templatesWindow}>
            <p className={os.toolbar}>
              <span>~/runsIT/Templates · {templateFiles.length} items</span>
              <Link href="/templates/">Browse all templates →</Link>
            </p>
            <div className={styles.windowBody}>
              <div className={styles.heading}>
                <h2 id="templates-heading">Our foundations. Your next idea.</h2>
              </div>
              <div className={styles.templateIntro}>
                <p>Start with a detailed AI prompt based on the structure behind our products. Describe your idea in your own words, then let your AI guide you through building and running it.</p>
                <p>No coding experience needed to get started. Each template covers setup, service connections, testing and upkeep, plus a file of follow-up prompts for what to do next.</p>
              </div>
              <ul className={styles.templateGrid}>
                {templateFiles.map((template) => (
                  <li key={template.id}>
                    <Link className={styles.templateCard} href={`/templates/#${template.id}`} style={{ "--tone": template.tone } as CSSProperties}>
                      <span className={styles.templateTop}>
                        <PromptFileIcon tone={template.tone} />
                        <span className={os.pixel}>{template.file}</span>
                      </span>
                      <h3>{template.title}</h3>
                      <span className={styles.templateCategory}>{template.category}</span>
                      <span className={styles.templateDescription}>{template.description}</span>
                      {template.demos.length > 0 && <span className={styles.templateDemo}>Live example: {template.demos.map((demo) => demo.name).join(", ")}</span>}
                      <span className={styles.templateAction}>Make it yours <ArrowIcon /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className={styles.templateNote}>Copy the prompt into your AI tool. Choose guided manual steps or computer control with a compatible AI. You own the app you build and use your own accounts; AI tools and hosting are separate.</p>
              <Link className={styles.installer} href="/templates/#prompt-builder">
                <span className={styles.installerIcon} aria-hidden="true">
                  <span />
                </span>
                <span className={styles.installerText}>
                  <span className={os.pixel}>PromptBuilder.app · Coming soon</span>
                  <strong>Love making apps?</strong>
                  <span>More creative freedom. More prompts for your next idea.</span>
                  <span className={styles.installerBar} aria-hidden="true"><span /></span>
                </span>
                <span className={styles.installerAction}>Check out this tool <ArrowIcon /></span>
              </Link>
            </div>
          </Window>

          <div className={styles.videoRow}>
            <Window as="section" id="intro" title="runsit-intro.mp4" tone="#7fd8c3" meta="0:22" labelledBy="intro-heading" className={styles.videoWindow}>
              <figure className={styles.video}>
                <video
                  controls
                  playsInline
                  preload="none"
                  poster="/videos/runsit-intro-poster.jpg"
                  width={1920}
                  height={1080}
                  aria-label="Watch the runsIT introduction"
                  aria-describedby="intro-video-description"
                >
                  <source src="/videos/runsit-intro.mp4" type="video/mp4" />
                  Your browser doesn’t support embedded video. <a href="/videos/runsit-intro.mp4">Watch the runsIT introduction</a>.
                </video>
                <figcaption>
                  <h2 id="intro-heading">A quick look at what you can build.</h2>
                  <span className={os.pixel}>22 seconds</span>
                </figcaption>
                <details className={styles.videoDescription}>
                  <summary>Read video description</summary>
                  <p id="intro-video-description">A short tour of runsIT’s apps and games: Neutronium, PulseDeals, The Last Echo, Local Lore and Build Your Room. An example shows choosing a browser game template, personalizing it as “City Quest,” then copying the purchased prompt into an AI tool. The video ends with “Our foundations. Your next idea.” Music and interface sounds play throughout; there is no spoken narration.</p>
                </details>
              </figure>
            </Window>
            <div className={styles.stickyNote}>
              <p>how it works:</p>
              <ol>
                <li>choose a template</li>
                <li>describe your idea</li>
                <li>paste the prompt into your AI</li>
                <li>follow the steps. done!</li>
              </ol>
            </div>
          </div>

          <div className={styles.pairRow}>
            <Window as="section" id="founders" title="Founders" tone="#c3b1ff" meta={`${founderCards.length} people`} labelledBy="founders-heading">
              <div className={styles.windowBody}>
                <div className={styles.heading}>
                  <h2 id="founders-heading">The people behind runsIT.</h2>
                  <p>Three founders building products and helping you start your own.</p>
                </div>
                <ul className={styles.founderList}>
                  {founderCards.map((founder) => (
                    <li key={founder.slug} className={styles.founderCard}>
                      <span className={styles.founderAvatar} style={{ background: founder.tone }} aria-hidden="true">{founder.initials}</span>
                      <div className={styles.founderText}>
                        <h3>{founder.name}</h3>
                        <span>{founder.role}</span>
                      </div>
                      <Link className={`${os.button} ${os.buttonLight} ${styles.founderLink}`} href={founder.portfolioUrl} aria-label={`View ${founder.name}’s portfolio`}>
                        View portfolio <ArrowIcon />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Window>

            <Window as="section" id="contact" title="hello.txt" tone="#fffdf7" labelledBy="contact-heading" className={styles.contactWindow}>
              <div className={styles.windowBody}>
                <p className={`${os.pixel} ${styles.contactKicker}`}>Get in touch</p>
                <h2 id="contact-heading">A product question or a different idea?</h2>
                <p className={styles.contactText}>Ask about our products or tell us the custom template you need.</p>
                <a className={os.button} href={`mailto:${site.email}`}>{site.email} <ArrowIcon /></a>
              </div>
            </Window>
          </div>
        </div>
      </main>

      <Taskbar backHref="#company" />
    </div>
  );
}
