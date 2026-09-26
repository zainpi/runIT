"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { APP_ICON_ADDON_CENTS, bundlePrice, discountedCents, discountedBundlePrice, DEFAULT_TEMPLATE_CURRENCY, EXTRA_TEMPLATE_CENTS, FIRST_TEMPLATE_CENTS, formatPrice, parseTemplateIds, SKILL_TREE_ADDON_CENTS, SUBAGENT_ADDON_CENTS, templateCatalog, type BuildMode, type TemplateCurrency, type TemplateId } from "@/lib/templates/catalog";
import { emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { templateDemos } from "@/lib/templates/demos";
import { site } from "@/lib/site";
import { TrialCode } from "./trial-code";
import { ReferralCode, type AppliedReferral } from "./referral-code";
import { loadDraft, saveDraft, saveReceipt } from "./browser-storage";
import { metaTrack, metaValue } from "@/lib/meta-pixel";
import shared from "./templates.module.css";
import styles from "./store.module.css";

function TemplateIcon({ symbol }: { symbol: string }) {
  const paths: Record<string, React.ReactNode> = {
    bot: <><rect x="5" y="8" width="22" height="18" rx="6" /><path d="M16 3v5M2 15v6m28-6v6M11 15v3m10-3v3m-10 4h10" /></>,
    blocks: <><path d="m16 3 12 7v13l-12 7L4 23V10L16 3Zm0 14 12-7M16 17 4 10m12 7v13M10 6.5l12 7" /></>,
    game: <><path d="M9 10h14c4 0 7 12 5 15-2 4-7-3-9-3h-6c-2 0-7 7-9 3C2 22 5 10 9 10Z" /><path d="M10 14v7m-3-3.5h6m8-3v1m4 3v1" /></>,
    phone: <><rect x="8" y="2" width="16" height="28" rx="4" /><path d="M13 6h6m-5 20h4M12 12h8m-8 5h5" /></>,
    shop: <><path d="M5 13v16h22V13M3 7l3-4h20l3 4v4c0 4-6 4-6 0 0 4-7 4-7 0 0 4-7 4-7 0 0 4-6 4-6 0V7ZM12 29V19h8v10" /></>,
    globe: <><circle cx="16" cy="16" r="13" /><ellipse cx="16" cy="16" rx="6" ry="13" /><path d="M3 16h26M6 8h20M6 24h20" /></>,
  };
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[symbol]}</svg>;
}

export function TemplateStore({ initialCurrency = DEFAULT_TEMPLATE_CURRENCY }: { initialCurrency?: TemplateCurrency }) {
  const [selected, setSelected] = useState<TemplateId[]>([]);
  const [details, setDetails] = useState<Personalization>(emptyPersonalization);
  const [mode, setMode] = useState<BuildMode>("manual");
  const [subagents, setSubagents] = useState(false);
  const [skillTree, setSkillTree] = useState(false);
  const [appIcon, setAppIcon] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [checkout, setCheckout] = useState<{ available: boolean; testMode: boolean; currency?: TemplateCurrency; appIconAvailable?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canceled, setCanceled] = useState(false);
  const [trialCheckout, setTrialCheckout] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [orderVisible, setOrderVisible] = useState(false);
  const orderPanel = useRef<HTMLElement | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referral, setReferral] = useState<AppliedReferral | null>(null);
  const currency = checkout?.currency ?? initialCurrency;
  const currencyLabel = currency.toUpperCase();
  const price = (cents: number) => formatPrice(cents, currency);
  useEffect(() => {
    const draft = loadDraft(); setSelected(draft.selected); setDetails(draft.details); setMode(draft.mode); setSubagents(draft.subagents); setSkillTree(draft.skillTree); setAppIcon(draft.appIcon); setExtrasOpen(draft.subagents || draft.skillTree || draft.appIcon); setLoaded(true);
    setCanceled(new URLSearchParams(location.search).has("canceled"));
    const referralFromUrl = new URLSearchParams(location.search).get("ref");
    if (referralFromUrl) { setReferralCode(referralFromUrl); setReferralOpen(true); }
    const openTrial = () => { if (location.hash === "#free-trial") { setTrialCheckout(true); orderPanel.current?.scrollIntoView({ block: "start" }); } };
    openTrial();
    window.addEventListener("hashchange", openTrial);
    metaTrack("ViewContent", { content_ids: templateCatalog.map((template) => template.id), content_type: "product_group", content_name: "AI build templates" });
    fetch("/api/templates/config/", { cache: "no-store" }).then((r) => r.json()).then(setCheckout).catch(() => setCheckout({ available: false, testMode: false }));
    return () => window.removeEventListener("hashchange", openTrial);
  }, []);
  useEffect(() => {
    // Browser Back can restore this component from the page cache after Stripe navigation.
    const resume = (event: PageTransitionEvent) => { if (event.persisted) setBusy(false); };
    window.addEventListener("pageshow", resume);
    return () => window.removeEventListener("pageshow", resume);
  }, []);
  useEffect(() => {
    if (!orderPanel.current) return;
    const observer = new IntersectionObserver(([entry]) => setOrderVisible(entry.intersectionRatio >= 0.15), { threshold: 0.15 });
    observer.observe(orderPanel.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (loaded) { try { saveDraft(details, mode, selected, subagents, skillTree, appIcon); } catch { /* Editing remains available without browser persistence. */ } } }, [details, mode, selected, subagents, skillTree, appIcon, loaded]);
  function toggle(id: TemplateId) {
    if (!selected.includes(id)) metaTrack("AddToCart", { content_ids: [id], content_type: "product", ...metaValue(selected.length ? EXTRA_TEMPLATE_CENTS : FIRST_TEMPLATE_CENTS, currency) });
    setSelected((current) => current.includes(id) ? current.filter((v) => v !== id) : [...current, id]); setError("");
  }
  function closeTrial() {
    setTrialCheckout(false);
    if (location.hash === "#free-trial") history.replaceState(null, "", `${location.pathname}${location.search}#bundle`);
  }
  async function buy() {
    setBusy(true); setError("");
    try {
      const ids = parseTemplateIds(selected);
      metaTrack("InitiateCheckout", { content_ids: ids, content_type: "product", num_items: ids.length, ...metaValue(total, currency) });
      // Persist before creating a payment so a closed tab never loses the access key.
      const cartKey = `${ids.join(",")}:currency=${currency}:subagents=${subagents}:skillTree=${skillTree}:appIcon=${appIcon}:referral=${referral?.code ?? "none"}`;
      const pending = JSON.parse(sessionStorage.getItem("runit-template-checkout") || "null");
      const token = pending?.cart === cartKey && /^[a-f0-9]{64}$/.test(pending.token) ? pending.token : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem("runit-template-checkout", JSON.stringify({ cart: cartKey, token }));
      localStorage.setItem("runit-template-storage-check", "ok"); localStorage.removeItem("runit-template-storage-check");
      const response = await fetch("/api/templates/checkout/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templates: ids, accessToken: token, subagents, skillTree, appIcon, referralCode: referral?.code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      saveReceipt({ sessionId: result.sessionId, accessToken: token, templates: ids, createdAt: new Date().toISOString(), subagents, skillTree, appIcon, projectNames: Object.fromEntries(ids.map((id) => [id, details.name.trim()])) });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("The checkout address could not be verified.");
      window.location.assign(url.href);
    } catch (cause) { setError(cause instanceof Error && cause.name !== "SecurityError" ? cause.message : "Allow browser storage so we can save your purchase access before checkout."); setBusy(false); }
  }
  const selectedTemplates = templateCatalog.filter((template) => selected.includes(template.id));
  const fullTotal = bundlePrice(selected.length, subagents, skillTree, appIcon);
  const total = referral ? discountedBundlePrice(selected.length, subagents, skillTree, referral.discountPercent, appIcon) : fullTotal;
  const addOnCount = Number(subagents) + Number(skillTree) + Number(appIcon);
  const cartPrice = (cents: number) => formatPrice(referral ? discountedCents(cents, referral.discountPercent) : cents, currency);
  const descriptions: Record<TemplateId, string> = {
    "discord-bot": "Automate your community.", "roblox-game": "Create a world worth playing.",
    "mobile-game": "Put your game in their pocket.", "mobile-app": "Make everyday life a little easier.",
    storefront: "Turn what you make into a business.", "browser-game": "Just a link. Ready to play.",
  };
  return <div className={styles.store}>
    <section className={styles.intro}>
      <p className={styles.eyebrow}>AI BUILD TEMPLATES</p>
      <h1>Your idea. <span>A head start.</span></h1>
      <p>Choose a template. Turn your idea into a complete build guide, a clickable HTML prototype, and a prompt for your coding AI.</p>
      <div className={styles.startingPrice}><strong>{price(FIRST_TEMPLATE_CENTS)} {currencyLabel}</strong><span>first template · {price(EXTRA_TEMPLATE_CENTS)} each extra</span></div>
    </section>
    {canceled && <p className={shared.notice} role="status">Checkout canceled. Your selection is saved.</p>}
    <div className={styles.checkoutGrid}>
      <section aria-labelledby="catalog-heading" className={styles.catalog}>
        <div className={styles.sectionHeading}><h2 id="catalog-heading">What will you make?</h2><span>Pick one or a few.</span></div>
        <div className={styles.templateGrid}>{templateCatalog.map((template) => {
          const added = selected.includes(template.id);
          return <article id={template.id} key={template.id} className={styles.template} data-selected={added}>
            <button className={styles.chooseTemplate} type="button" aria-pressed={added} aria-label={`${added ? "Remove" : "Add"} ${template.title}`} disabled={busy} onClick={() => toggle(template.id)}>
              <span className={styles.templateTop}><span className={styles.icon}><TemplateIcon symbol={template.symbol} /></span><span className={styles.selection} aria-hidden="true">{added ? "✓" : "+"}</span></span>
              <strong>{template.title}</strong><span className={styles.description}>{descriptions[template.id]}</span>
            </button>
            <details className={styles.templateDetails}><summary>Details <span aria-hidden="true">⌄</span></summary><div><p>{template.description}</p><ul>{template.includes.map((item) => <li key={item}>{item}</li>)}</ul>{templateDemos[template.id].map((demo) => <a key={demo.url} href={demo.url} target="_blank" rel="noopener noreferrer">View {demo.name} demo ↗</a>)}</div></details>
          </article>;
        })}</div>
        <p className={styles.included}><span aria-hidden="true">✓</span> Every order includes an AI plan, 20 edits, a complete HTML build guide with a simulated prototype, and downloadable build prompts.</p>
      </section>
      <aside id="bundle" ref={orderPanel} className={styles.order} aria-label="Your order">
        {trialCheckout ? <>
          <div className={styles.orderHeading}><h2>Try your idea for free.</h2><span>FREE</span></div>
          <p className={styles.trialIntro}>A personalized plan + 3 AI edits. No card needed.</p>
          <TrialCode selected={selected} details={details} onDetails={setDetails} onCancel={closeTrial} />
        </> : <>
          <div className={styles.orderHeading}><h2>Your order</h2><span>{selected.length} selected</span></div>
          {selected.length ? <ul className={styles.orderItems} aria-label="Selected items">{selectedTemplates.map((template, index) => <li key={template.id}><span>{template.title}</span><strong>{cartPrice(index === 0 ? FIRST_TEMPLATE_CENTS : EXTRA_TEMPLATE_CENTS)}</strong><button type="button" aria-label={`Remove ${template.title} from bundle`} disabled={busy} onClick={() => toggle(template.id)}>×</button></li>)}</ul> : <p className={styles.empty}>Choose a template to get started.<br />You’ll make it your own after checkout.</p>}
          <details className={styles.extras} open={extrasOpen} onToggle={(event) => setExtrasOpen(event.currentTarget.open)}>
            <summary>Optional extras <span>{addOnCount ? `${addOnCount} added` : ""}<b aria-hidden="true">+</b></span></summary>
            <div className={styles.addonList}>
              <label className={styles.addon} data-selected={appIcon}>
                <input type="checkbox" aria-label="Create app icon" aria-describedby="icon-extra-description" checked={appIcon} disabled={busy || (!checkout?.appIconAvailable && !appIcon)} onChange={(event) => setAppIcon(event.target.checked)} />
                <span><strong>App icon <b>+{cartPrice(APP_ICON_ADDON_CENTS)}</b></strong><small id="icon-extra-description">1 icon + 3 updates. Download every version.</small>{checkout && !checkout.appIconAvailable && <small>Temporarily unavailable{appIcon ? "; uncheck to continue" : ""}.</small>}</span>
              </label>
              <label className={styles.addon} data-selected={subagents}>
                <input type="checkbox" aria-label="Add AI teamwork" aria-describedby="subagent-extra-description" checked={subagents} disabled={busy} onChange={(event) => setSubagents(event.target.checked)} />
                <span><strong>AI teamwork <b>+{cartPrice(SUBAGENT_ADDON_CENTS)}</b></strong><small id="subagent-extra-description">A prompt for coordinating multiple AI agents.</small></span>
              </label>
              <label className={styles.addon} data-selected={skillTree}>
                <input type="checkbox" aria-label="Add skills & tools setup" aria-describedby="skills-extra-description" checked={skillTree} disabled={busy} onChange={(event) => setSkillTree(event.target.checked)} />
                <span><strong>Skills & tools setup <b>+{cartPrice(SKILL_TREE_ADDON_CENTS)}</b></strong><small id="skills-extra-description">A setup guide for your AI’s skills and tools.</small></span>
              </label>
              <p className={styles.extraNote}>One-time prices for this order, in {currencyLabel}.</p>
            </div>
          </details>
          <div className={styles.total} aria-live="polite" aria-atomic="true"><div><span>{selected.length ? "Total" : "Starting at"}</span><small>One-time payment · {currencyLabel}</small></div><strong>{price(selected.length ? total : FIRST_TEMPLATE_CENTS)}</strong></div>
          {referral && <p className={styles.discount}>{referral.discountPercent}% off applied to this order</p>}
          <button className={styles.checkoutButton} disabled={!selected.length || busy || !checkout?.available || (appIcon && !checkout.appIconAvailable)} onClick={buy}>{busy ? "Opening checkout…" : checkout === null ? "Loading…" : !checkout.available ? "Checkout coming soon" : appIcon && !checkout.appIconAvailable ? "App icon unavailable" : referral?.discountPercent === 100 ? "Complete free checkout →" : checkout.testMode ? "Try test checkout →" : "Continue to checkout →"}</button>
          <p className={styles.paymentNote}>{referral?.discountPercent === 100 ? "No card needed · Checkout with Stripe" : checkout?.testMode ? "Test mode · No real payment" : "Secure checkout with Stripe"}</p>
          {error && <p className={shared.error} role="alert">{error}</p>}
          <div className={styles.codeOptions}>
            <details open={referralOpen} onToggle={(event) => setReferralOpen(event.currentTarget.open)}><summary>Add a discount code</summary><ReferralCode value={referralCode} applied={referral} disabled={busy} onChange={(value) => { setReferralCode(value); setReferral(null); }} onApplied={setReferral} /></details>
            <button type="button" disabled={busy} onClick={() => setTrialCheckout(true)}>Have a free-trial code?</button>
          </div>
          <p className={styles.saveNote}>Save your private link after checkout to return later.</p>
        </>}
      </aside>
    </div>
    <section className={styles.help} aria-label="Good to know">
      <details><summary>How does it work?<span aria-hidden="true">+</span></summary><p>Choose a template and pay once. Describe your idea, review and refine its plan, then create your complete build guide. Download one HTML file with simple steps, official resources, a detailed specification and a clickable prototype. Paste its full prompt into your coding AI to implement and test the app. The prototype uses sample data; it is not a working backend.</p></details>
      <details><summary>What’s included?<span aria-hidden="true">+</span></summary><p>Each template includes a build prompt, one free AI overview, and one successful complete-guide generation. The guide covers setup, data, permissions, features, tests, launch and maintenance. Your order also includes 20 AI editing messages; regenerating a guide uses one of those messages. Failed guide attempts do not use a message. Full guides require a purchase; the free trial includes the short plan and three edits. Optional extras are charged once per order. App icon creation includes a 1024 × 1024 PNG and three updates, with every version available to download.</p><p>Your coding AI, hosting, and third-party tools may have their own costs.</p></details>
      <div className={styles.support}><Link href="/templates/library/">Already purchased? Open my templates →</Link><a id="prompt-builder" href={`mailto:${site.email}?subject=${encodeURIComponent("Prompt builder access")}&body=${encodeURIComponent("Hi runsIT, I’m interested in the upcoming prompt builder. Please share more about access.")}`}>Prompt builder · Coming soon ↗</a><a href={`mailto:${site.email}?subject=${encodeURIComponent("AI template enquiry")}`}>Need a hand?</a></div>
    </section>
    {!!selected.length && !trialCheckout && !orderVisible && <div className={styles.mobileOrder}><div><strong>{price(total)} {currencyLabel}</strong><span>{selected.length} template{selected.length === 1 ? "" : "s"}{addOnCount ? ` + ${addOnCount} extra${addOnCount === 1 ? "" : "s"}` : ""}</span></div><a href="#bundle">Review order <span aria-hidden="true">→</span></a></div>}
  </div>;
}
