"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { bundlePrice, DEFAULT_TEMPLATE_CURRENCY, formatPrice, parseTemplateIds, SKILL_TREE_ADDON_CENTS, SUBAGENT_ADDON_CENTS, templateCatalog, type BuildMode, type TemplateCurrency, type TemplateId } from "@/lib/templates/catalog";
import { composePrompt, emptyPersonalization, type Personalization } from "@/lib/templates/compose";
import { templateDemos } from "@/lib/templates/demos";
import { site } from "@/lib/site";
import { Personalize } from "./personalize";
import { loadDraft, saveDraft, saveReceipt } from "./browser-storage";
import styles from "./templates.module.css";

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
  const [loaded, setLoaded] = useState(false);
  const [checkout, setCheckout] = useState<{ available: boolean; testMode: boolean; currency?: TemplateCurrency } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canceled, setCanceled] = useState(false);
  const currency = checkout?.currency ?? initialCurrency;
  const currencyLabel = currency.toUpperCase();
  const price = (cents: number) => formatPrice(cents, currency);
  useEffect(() => {
    const draft = loadDraft(); setSelected(draft.selected); setDetails(draft.details); setMode(draft.mode); setSubagents(draft.subagents); setSkillTree(draft.skillTree); setLoaded(true);
    setCanceled(new URLSearchParams(location.search).has("canceled"));
    fetch("/api/templates/config/", { cache: "no-store" }).then((r) => r.json()).then(setCheckout).catch(() => setCheckout({ available: false, testMode: false }));
  }, []);
  useEffect(() => { if (loaded) { try { saveDraft(details, mode, selected, subagents, skillTree); } catch { /* Editing remains available without browser persistence. */ } } }, [details, mode, selected, subagents, skillTree, loaded]);
  function toggle(id: TemplateId) { setSelected((current) => current.includes(id) ? current.filter((v) => v !== id) : [...current, id]); setError(""); }
  async function buy() {
    setBusy(true); setError("");
    try {
      const ids = parseTemplateIds(selected);
      // Persist before creating a payment so a closed tab never loses the access key.
      const cartKey = `${ids.join(",")}:currency=${currency}:subagents=${subagents}:skillTree=${skillTree}`;
      const pending = JSON.parse(sessionStorage.getItem("runit-template-checkout") || "null");
      const token = pending?.cart === cartKey && /^[a-f0-9]{64}$/.test(pending.token) ? pending.token : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem("runit-template-checkout", JSON.stringify({ cart: cartKey, token }));
      localStorage.setItem("runit-template-storage-check", "ok"); localStorage.removeItem("runit-template-storage-check");
      const response = await fetch("/api/templates/checkout/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templates: ids, accessToken: token, subagents, skillTree }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      saveReceipt({ sessionId: result.sessionId, accessToken: token, templates: ids, createdAt: new Date().toISOString(), subagents, skillTree });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("The checkout address could not be verified.");
      window.location.assign(url.href);
    } catch (cause) { setError(cause instanceof Error && cause.name !== "SecurityError" ? cause.message : "Allow browser storage so we can save your purchase access before checkout."); setBusy(false); }
  }
  const sample = composePrompt("your app", "[Your purchased template adds the complete architecture, data model, service integrations, implementation milestones, tests, deployment and maintenance plan here.]", details, mode);
  return <>
    <section className={styles.hero}>
      <p className={styles.eyebrow}><span className={styles.dot} /> AI build templates</p>
      <div className={styles.heroRow}><h1>Your idea.<br /><em>A head start.</em></h1><div><p className={styles.heroDescription}><strong>No coding experience needed to get started.</strong> Bring your idea, copy a template into your AI tool, and let it guide you through building your own app, one simple step at a time.</p><p className={styles.heroPrice}><strong>{price(999)} {currencyLabel}</strong> for your first template.<br /><span>+$5 for every extra one in your bundle. {currencyLabel}.</span></p><p className={styles.modelHint}>Our recommended setup: <strong>GPT-6 Astra + High thinking.</strong><br /><a href="#model-guide">See the thinking-level guide →</a></p></div></div>
      <div className={styles.steps}><span><b>01</b> Pick your foundation</span><span><b>02</b> Add your idea</span><span><b>03</b> Copy. Build. Make it yours.</span></div>
    </section>
    {canceled && <p className={styles.notice} role="status">Checkout canceled. Your selection is saved. You can try again whenever you’re ready.</p>}
    <section className={styles.shop} aria-labelledby="catalog-heading">
      <div><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / Pick your foundation</p><h2 id="catalog-heading">What will you make?</h2></div><span className={styles.small}>6 ways to start</span></div>
        <div className={styles.grid}>{templateCatalog.map((template, index) => {
          const added = selected.includes(template.id);
          return <article id={template.id} className={`${styles.card} ${styles[template.color]}`} key={template.id} data-selected={added}>
            <div className={styles.cardTop}><span className={styles.icon}><TemplateIcon symbol={template.symbol} /></span><span className={styles.cardNumber}>0{index + 1} / {template.category}</span></div>
            <h3>{template.title}</h3><p>{template.description}</p>
            {templateDemos[template.id].length > 0 && <div className={styles.demoLinks}>{templateDemos[template.id].map((demo) => <a key={demo.url} href={demo.url} target="_blank" rel="noopener noreferrer" aria-label={`Check out a demo: ${demo.name} (opens in a new tab)`}><strong>Check out a demo ↗</strong><span>{demo.name}</span></a>)}</div>}
            <details><summary>What’s inside <span>+</span></summary><ul>{template.includes.map((item) => <li key={item}>{item}</li>)}</ul></details>
            <div className={styles.cardBottom}><span>{template.stack}</span><button type="button" aria-pressed={added} aria-label={`${added ? "Remove" : "Add"} ${template.title}`} onClick={() => toggle(template.id)}>{added ? "Added ✓" : "Add +"}</button></div>
          </article>;
        })}</div>
        <div className={styles.customCard}><div><p className={styles.eyebrow}>Something different?</p><h3>Let’s find your foundation.</h3><p>Tell us what you want to build. We can talk about a custom template.</p></div><a href={`mailto:${site.email}?subject=${encodeURIComponent("Custom AI template request")}`}>Email for custom ↗</a></div>
      </div>
    </section>
    <section id="personalize" className={styles.workshop}><Personalize details={details} mode={mode} onDetails={setDetails} onMode={setMode} previewOnly /></section>
    <aside id="bundle" className={styles.cart} aria-label="Your bundle"><div className={styles.cartOptions}><p className={styles.eyebrow}>Your bundle</p><h2>{selected.length ? `${selected.length} template${selected.length === 1 ? "" : "s"}` : "A fresh start."}</h2>
        {selected.length ? <ul>{templateCatalog.filter((t) => selected.includes(t.id)).map((t, i) => <li key={t.id}><span>{t.title}</span><span>{price(i === 0 ? 999 : 500)}<button aria-label={`Remove ${t.title} from bundle`} onClick={() => toggle(t.id)}>×</button></span></li>)}</ul> : <p className={styles.muted}>Choose a template to start your bundle. Every extra template is just $5.</p>}
        <label className={styles.addon} data-selected={subagents}>
          <input type="checkbox" aria-label="Add subagent workflow" checked={subagents} disabled={busy} onChange={(event) => setSubagents(event.target.checked)} />
          <span><strong>Add subagent workflow <b>+{price(SUBAGENT_ADDON_CENTS)}</b></strong><span>A lead AI such as Astra plans and reviews. Cheaper agents handle suitable coding tasks.</span><small>One-time $5 {currencyLabel} for your entire bundle. Adds prompt instructions; AI usage is separate.</small></span>
        </label>
        <label className={styles.addon} data-selected={skillTree}>
          <input type="checkbox" aria-label="Add skill tree setup" checked={skillTree} disabled={busy} onChange={(event) => setSkillTree(event.target.checked)} />
          <span><strong>Add skill tree setup <b>+{price(SKILL_TREE_ADDON_CENTS)}</b></strong><span>A setup prompt with source links for skills and tools, organized around your business and selected apps.</span><small>One-time $10 {currencyLabel} for your entire bundle. Includes Cloudflare, Stripe, Roblox tooling, design and more. Third-party access and fees are separate.</small></span>
        </label>
      </div><div className={styles.cartSummary}>
        {skillTree && selected.length > 0 && <p className={styles.addonLine}><span>Skill tree setup × 1</span><span>{price(SKILL_TREE_ADDON_CENTS)}</span></p>}
        {subagents && selected.length > 0 && <p className={styles.addonLine}><span>Subagent workflow × 1</span><span>{price(SUBAGENT_ADDON_CENTS)}</span></p>}
        <div className={styles.total}><span>One-time total <small>{currencyLabel}</small></span><strong>{price(bundlePrice(selected.length, subagents, skillTree))}</strong></div>
        <button className={styles.primary} disabled={!selected.length || busy || !checkout?.available} onClick={buy}>{busy ? "Opening checkout…" : checkout === null ? "Checking availability…" : !checkout.available ? "Checkout coming soon" : checkout.testMode ? "Try test checkout ↗" : "Continue to checkout ↗"}</button>
        <p className={styles.small}>{checkout?.testMode ? "Test mode. No real payment is collected." : "Secure payment with Stripe. Copy and download after payment."}</p>
        <p className={styles.small}>After checkout, save your unique purchase URL. It brings you back to your prompts on any device.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.cartNotes}><p>✓ Complete architecture & service setup</p><p>✓ Guidance for complete beginners</p><p>✓ Both build modes included</p><p>✓ Copyable prompt & .txt download</p><p>✓ Follow-up prompt guide for your app</p></div>
        <p className={styles.small}>Pricing applies per order. AI subscriptions, developer accounts, hosting, and service usage are separate. You’re buying a prompt, not a finished app.</p>
        <Link href="/templates/library/" className={styles.textLink}>Already purchased? My templates →</Link>
      </div>
    </aside>
    <section className={styles.previewSection}><div><p className={styles.eyebrow}>A look inside</p><h2>A prompt with a plan.</h2><p className={styles.muted}>Start with an idea, even if this is your first app. Every template asks your AI to explain unfamiliar terms, provide the code, and walk you through setup, testing and keeping your app running with simple steps and direct links.</p><p className={styles.small}>This free preview shows the shared instructions and your brief. Each paid template adds its full, platform-specific foundation.</p>{subagents && <p className={styles.small}>Subagent add-on selected. Its delegation, budget, and review instructions unlock after payment and work with either build mode.</p>}{skillTree && <p className={styles.small}>Skill tree selected. Your source directory and installation prompt unlock after payment, with a separate setup download.</p>}</div><details className={styles.sample}><summary>Preview your personalized instructions <span>↗</span></summary><pre>{sample}</pre></details></section>
    <section className={styles.faq} aria-labelledby="faq-heading"><h2 id="faq-heading">Before you start.</h2><div>
      <details><summary>What do I get?</summary><p>A detailed, editable text prompt for each selected foundation. It covers structure, data, integrations, setup URLs, tests, publishing, and safe operation. Paste it into a coding AI, explain your idea, and work through the build. It also asks your AI to create FOLLOW_UP_PROMPTS.md: a file of ready-to-copy prompts for adding features, fixing issues, launching and maintaining your app.</p></details>
      <details><summary>Do I need coding experience?</summary><p>No. These templates are designed to help you build your first app without prior coding experience. Your AI explains unfamiliar terms, provides the code, and guides you through setup and testing. You bring the idea, create your own accounts, and check that the result works how you want. Choose guided manual steps or let a compatible AI tool help operate your computer.</p></details>
      <details><summary>Can I change the prompt after buying?</summary><p>Yes. Edit your idea, switch build modes, and copy or download it again. Save your private order link and downloaded files; browser storage can be cleared.</p></details>
      <details><summary>What does the subagent add-on do?</summary><p>For $5 {currencyLabel} once per order, every template in your bundle gets an optional workflow for a lead AI such as Astra to plan and review, with cheaper capable agents doing suitable coding tasks. It includes task boundaries, budget controls, testing, and a manual handoff option. Actual model availability and costs depend on your AI tool. This buys prompt instructions; it does not include AI credits or guarantee lower running costs.</p></details>
      <details><summary>What does the skill tree include?</summary><p>For $10 {currencyLabel} once per order, get a skill and tool directory with original source links, branches matched to your selected templates, and a prompt to install and verify the supported tools. It covers infrastructure, payments, game tooling, design, testing, and business documents. In manual mode, your AI walks you through installation; computer mode uses the tools it actually has. Some capabilities come through plugins or built-in features and depend on your AI app and account. You pay for our setup guide; third-party skills retain their own licenses, and many are free. Service subscriptions, account access, and the $5 subagent workflow are separate.</p></details>
      <details><summary>Will the AI build everything automatically?</summary><p>Results depend on your AI tool and your requirements. Computer control works only with tools that support it. You still handle logins, approve costs, test the result, and decide when to publish.</p></details>
      <details><summary>What if I need help with an order?</summary><p>Email <a href={`mailto:${site.email}`}>{site.email}</a> with your Stripe receipt for access or refund assistance. Don’t send passwords or API keys. If you lose your private link, we can verify your receipt and help recover access.</p></details>
    </div></section>
    {selected.length > 0 && <div className={styles.mobileBundle}><span aria-live="polite">{selected.length} template{selected.length > 1 ? "s" : ""}{subagents || skillTree ? ` + ${Number(subagents) + Number(skillTree)} add-on${subagents && skillTree ? "s" : ""}` : ""} · <strong>{price(bundlePrice(selected.length, subagents, skillTree))} {currencyLabel}</strong></span><a href="#bundle">View bundle →</a></div>}
  </>;
}
