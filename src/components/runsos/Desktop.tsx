"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { EXTRA_TEMPLATE_CENTS, FIRST_TEMPLATE_CENTS, formatPrice } from "@/lib/templates/catalog";
import { site } from "@/lib/site";
import { desktopApps, founderCards, templateFiles } from "./apps";
import { ArrowIcon, FolderIcon, PromptFileIcon, TextFileIcon } from "./icons";
import { Window } from "./Window";
import os from "./os.module.css";
import styles from "./desktop.module.css";

type WindowId = "welcome" | "app" | "folder";
type Panel = "templates" | "founders" | "contact";
type Offset = { x: number; y: number };
type Drag = { id: WindowId; pointerId: number; startX: number; startY: number; origin: Offset; minX: number; maxX: number; minY: number; maxY: number };

const panelTitles: Record<Panel, string> = { templates: "Templates", founders: "Founders", contact: "hello.txt" };
const panels: Panel[] = ["templates", "founders", "contact"];
const noOffset: Offset = { x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
const matches = (query: string) => typeof window !== "undefined" && window.matchMedia(query).matches;

/** The homepage hero: a small desktop whose icons open the real products, templates and founders. */
export function Desktop() {
  const [appId, setAppId] = useState(desktopApps[0].id);
  const [panel, setPanel] = useState<Panel>("templates");
  const [closed, setClosed] = useState<Record<WindowId, boolean>>({ welcome: false, app: false, folder: false });
  const [stack, setStack] = useState<WindowId[]>(["welcome", "folder", "app"]);
  const [offsets, setOffsets] = useState<Record<WindowId, Offset>>({ welcome: noOffset, app: noOffset, folder: noOffset });
  const deskRef = useRef<HTMLElement>(null);
  const slots = useRef<Record<WindowId, HTMLDivElement | null>>({ welcome: null, app: null, folder: null });
  const drag = useRef<Drag | null>(null);

  const app = desktopApps.find((item) => item.id === appId) ?? desktopApps[0];

  // Dragged positions only make sense on the free-form desktop layout; drop them when it stacks.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1180px)");
    const reset = () => { if (!wide.matches) setOffsets({ welcome: noOffset, app: noOffset, folder: noOffset }); };
    wide.addEventListener("change", reset);
    return () => wide.removeEventListener("change", reset);
  }, []);

  const raise = (id: WindowId) => setStack((current) => (current[current.length - 1] === id ? current : [...current.filter((item) => item !== id), id]));

  const open = (id: WindowId) => {
    setClosed((current) => ({ ...current, [id]: false }));
    raise(id);
    // On stacked (phone) layouts the window may be off screen; bring it into view.
    if (matches("(max-width: 759px)")) {
      requestAnimationFrame(() => slots.current[id]?.scrollIntoView({ behavior: matches("(prefers-reduced-motion: reduce)") ? "auto" : "smooth", block: "start" }));
    }
  };

  const openApp = (id: string) => { setAppId(id as typeof appId); open("app"); };
  const openPanel = (next: Panel) => { setPanel(next); open("folder"); };
  const close = (id: WindowId) => setClosed((current) => ({ ...current, [id]: true }));

  const startDrag = (id: WindowId) => (event: ReactPointerEvent<HTMLDivElement>) => {
    raise(id);
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, a") || !matches("(min-width: 1180px) and (pointer: fine)")) return;
    const desk = deskRef.current?.getBoundingClientRect();
    const slot = slots.current[id]?.getBoundingClientRect();
    if (!desk || !slot) return;
    const origin = offsets[id];
    const baseLeft = slot.left - origin.x;
    const baseTop = slot.top - origin.y;
    drag.current = {
      id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin,
      minX: desk.left - baseLeft, maxX: desk.right - baseLeft - slot.width,
      minY: desk.top - baseTop, maxY: desk.bottom - baseTop - 120,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const x = clamp(current.origin.x + event.clientX - current.startX, current.minX, current.maxX);
    const y = clamp(current.origin.y + event.clientY - current.startY, current.minY, current.maxY);
    setOffsets((all) => ({ ...all, [current.id]: { x, y } }));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const titleBar = (id: WindowId) => ({ onPointerDown: startDrag(id), onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag, className: styles.dragHandle });

  const slotStyle = (id: WindowId): CSSProperties => ({
    zIndex: stack.indexOf(id) + 1,
    transform: offsets[id].x || offsets[id].y ? `translate(${offsets[id].x}px, ${offsets[id].y}px)` : undefined,
  });

  const allClosed = closed.welcome && closed.app && closed.folder;

  return (
    <section id="company" ref={deskRef} className={styles.desktop} aria-labelledby="welcome-heading">
      <span className={styles.wallpaperMark} aria-hidden="true">runsIT</span>

      <div className={styles.stage}>
        <div className={styles.sidebar}>
          <div className={styles.icons} role="group" aria-label="Desktop">
            {desktopApps.map((item) => (
              <button key={item.id} type="button" className={styles.icon} aria-pressed={item.id === app.id && !closed.app} onClick={() => openApp(item.id)}>
                <Image className={styles.iconImage} src={item.icon} alt="" width={62} height={62} style={{ background: item.background }} unoptimized />
                <span className={styles.iconLabel}>{item.name}</span>
              </button>
            ))}
            <button type="button" className={styles.icon} aria-pressed={panel === "templates" && !closed.folder} onClick={() => openPanel("templates")}>
              <FolderIcon className={styles.iconSvg} />
              <span className={styles.iconLabel}>Templates</span>
            </button>
            <button type="button" className={styles.icon} aria-pressed={panel === "founders" && !closed.folder} onClick={() => openPanel("founders")}>
              <FolderIcon className={styles.iconSvg} tone="#c3b1ff" />
              <span className={styles.iconLabel}>Founders</span>
            </button>
            <button type="button" className={styles.icon} aria-pressed={panel === "contact" && !closed.folder} onClick={() => openPanel("contact")}>
              <TextFileIcon className={styles.iconSvg} />
              <span className={styles.iconLabel}>hello.txt</span>
            </button>
            <button type="button" className={closed.welcome ? styles.icon : `${styles.icon} ${styles.optionalIcon}`} aria-pressed={!closed.welcome} onClick={() => open("welcome")}>
              <TextFileIcon className={styles.iconSvg} />
              <span className={styles.iconLabel}>welcome.txt</span>
            </button>
          </div>
          <div className={styles.note}>
            <p className={styles.noteTitle}>todo:</p>
            <ol>
              <li>pick a template</li>
              <li>describe my idea</li>
              <li>build it!!</li>
            </ol>
          </div>
        </div>

        <div ref={(node) => { slots.current.welcome = node; }} className={`${styles.slot} ${styles.slotWelcome}`} style={slotStyle("welcome")} onPointerDown={() => raise("welcome")} hidden={closed.welcome}>
          <Window title="welcome.txt" tone="#ff8a6b" onClose={() => close("welcome")} titleBarProps={titleBar("welcome")} labelledBy="welcome-heading">
            <div className={styles.welcomeBody}>
              <p className={`${os.pixel} ${styles.readme}`}>README · Products &amp; AI templates. Built in Canada.</p>
              <h1 id="welcome-heading" className={styles.welcomeTitle}>
                Hi, we’re runsIT.
                <span>Explore our products. Build your own.</span>
              </h1>
              <p className={styles.welcomeText}>
                We build apps, games and tools you can use today. Our AI templates share the foundations behind those
                products, so you can turn your own idea into an app with step-by-step guidance. No coding experience
                needed to get started.
              </p>
              <div className={styles.actions}>
                <Link className={os.button} href="/templates/">Build with a template <ArrowIcon /></Link>
                <a className={`${os.button} ${os.buttonLight}`} href="#products">Explore our products</a>
              </div>
            </div>
          </Window>
        </div>

        <div ref={(node) => { slots.current.app = node; }} className={`${styles.slot} ${styles.slotApp}`} style={slotStyle("app")} onPointerDown={() => raise("app")} hidden={closed.app}>
          <Window title={app.file} tone={app.tone} onClose={() => close("app")} titleBarProps={titleBar("app")} labelledBy="desktop-app-name">
            <div className={styles.appArt} style={{ background: app.background }}>
              <Image key={app.id} className={styles.appImage} src={app.image} alt={app.imageAlt} width={app.width} height={app.height} unoptimized />
            </div>
            <div className={styles.appBody} aria-live="polite">
              <span className={os.chip} style={{ "--tone": app.tone } as CSSProperties}>{app.category}</span>
              <h2 id="desktop-app-name" className={styles.appName}>{app.name}</h2>
              <p className={styles.appText}>{app.description}</p>
              <div className={styles.actions}>
                <a className={`${os.button} ${os.buttonDark}`} href={app.href}>{app.action}</a>
                {app.template ? (
                  <Link className={`${os.button} ${os.buttonSun}`} href={`/templates/#${app.template.id}`}>Make your own: {app.template.title}</Link>
                ) : (
                  <span className={styles.appNote}>Company software, not a template</span>
                )}
              </div>
            </div>
          </Window>
        </div>

        <div ref={(node) => { slots.current.folder = node; }} className={`${styles.slot} ${styles.slotFolder}`} style={slotStyle("folder")} onPointerDown={() => raise("folder")} hidden={closed.folder}>
          <Window title={panelTitles[panel]} tone="#ffd23f" onClose={() => close("folder")} titleBarProps={titleBar("folder")}>
            <div className={styles.tabs} role="group" aria-label="Folders">
              {panels.map((item) => (
                <button key={item} type="button" className={styles.tab} aria-pressed={panel === item} onClick={() => setPanel(item)}>{panelTitles[item]}</button>
              ))}
            </div>
            <div className={styles.folderBody}>
              {panel === "templates" && (
                <ul className={styles.files}>
                  {templateFiles.map((file) => (
                    <li key={file.id}>
                      <Link className={styles.file} href={`/templates/#${file.id}`} aria-label={`${file.title} template`}>
                        <PromptFileIcon tone={file.tone} />
                        <span>{file.file.replace(/\.prompt$/, "")}<wbr />.prompt</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {panel === "founders" && (
                <ul className={styles.people}>
                  {founderCards.map((founder) => (
                    <li key={founder.slug} className={styles.person}>
                      <span className={styles.avatar} style={{ background: founder.tone }} aria-hidden="true">{founder.initials}</span>
                      <span className={styles.personName}>{founder.name}</span>
                      <span className={styles.personRole}>{founder.role}</span>
                      <Link className={styles.personLink} href={founder.portfolioUrl} aria-label={`View ${founder.name}’s portfolio`}>Portfolio</Link>
                    </li>
                  ))}
                </ul>
              )}
              {panel === "contact" && (
                <div className={styles.contactPanel}>
                  <p className={os.pixel}>A product question, or a template you wish existed? Write to us:</p>
                  <a className={os.button} href={`mailto:${site.email}`}>{site.email}</a>
                </div>
              )}
            </div>
            <p className={os.statusBar}>
              {panel === "templates" && `${templateFiles.length} templates · first one ${formatPrice(FIRST_TEMPLATE_CENTS)}, then ${formatPrice(EXTRA_TEMPLATE_CENTS)} each · no coding experience needed`}
              {panel === "founders" && `${founderCards.length} co-founders · Built in Canada`}
              {panel === "contact" && site.email}
            </p>
          </Window>
        </div>

        {allClosed && (
          <p className={`${os.hand} ${styles.emptyDesktop}`}>all clean! click an icon to open it again.</p>
        )}
      </div>

      <div className={styles.dock} role="group" aria-label="Dock">
        {desktopApps.map((item) => (
          <button key={item.id} type="button" className={styles.dockButton} aria-label={`Open ${item.name}`} aria-pressed={item.id === app.id && !closed.app} onClick={() => openApp(item.id)}>
            <Image className={styles.dockImage} src={item.icon} alt="" width={52} height={52} style={{ background: item.background }} unoptimized />
          </button>
        ))}
        <span className={styles.dockDivider} aria-hidden="true" />
        <Link className={`${os.button} ${styles.dockBuild}`} href="/templates/">Build your own</Link>
      </div>
    </section>
  );
}
