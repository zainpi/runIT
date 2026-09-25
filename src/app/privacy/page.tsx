import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { company } from "@/lib/company";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";

const updated = "2026-09-25";
const title = "Privacy policy";
const description = "How runsIT handles information on runsit.ca and runs-it.com: contact messages, AI template orders, AI planning, browser storage, cookies and your choices.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy/" },
  openGraph: { type: "website", url: "/privacy/", siteName: site.name, title: `${title} | ${site.name}`, description, locale: "en_CA", images: [siteSocialImage] },
  twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [siteSocialImage] },
};

const email = <a href={`mailto:${site.email}`}>{site.email}</a>;

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "What this policy covers",
    body: <>
      <p>This policy explains how runsIT, an independent software company in {company.country}, handles personal information on runsit.ca and runs-it.com, in the AI template store and when you contact us.</p>
      <p>Our products have their own policies, which apply when you use them: the <a href="/pulsedeals/privacy.html">PulseDeals privacy policy</a>, <a href="/the-last-echo/privacy.html">The Last Echo privacy policy</a> and the <a href="/local-lore/privacy.html">Local Lore privacy policy</a>. Build Your Room runs on Roblox, so Roblox’s policies apply there. Neutronium handles company and employee information on behalf of the organizations that use it; if your employer uses Neutronium, contact them first about that information.</p>
    </>,
  },
  {
    id: "collect",
    title: "Information we collect",
    body: <>
      <h3>When you contact us</h3>
      <p>Your name, email address, the topic you choose and your message. Contact-form messages are delivered to our inbox by email; if you write to {email} directly, we receive whatever you include.</p>
      <h3>When you buy AI templates</h3>
      <p>Payments are handled by Stripe on its own checkout page. Stripe collects your payment details; we do not receive your full card number. From Stripe we receive order details such as the templates and extras you bought, the amount, currency, payment status, any discount code used and the contact details you give Stripe.</p>
      <h3>When you plan, generate guides or create an app icon</h3>
      <p>The app idea, project details and chat messages you enter are sent to OpenAI to create your plan, build guide or icon. We ask for your permission before the first request, send only what the task needs, and request that OpenAI not store responses for later use. OpenAI’s own policies govern its processing. Your private purchase link and access token are never sent to OpenAI.</p>
      <p>Your saved briefs, plans, chat messages and icons are stored with your order on Cloudflare so you can return to them. You can delete them at any time from your templates page; small usage counters remain so your included allowance still applies.</p>
      <h3>Automatically</h3>
      <p>Our hosting and security provider, Cloudflare, processes technical information such as IP addresses, browser details and the pages requested in order to deliver the site and protect it from abuse. If you accept analytics cookies, Google Analytics also receives usage information (see below).</p>
    </>,
  },
  {
    id: "use",
    title: "How we use it",
    body: <>
      <ul>
        <li>To answer your messages and provide support.</li>
        <li>To deliver your purchases, keep your private template link working and apply your included AI allowance.</li>
        <li>To generate the plans, guides and icons you ask for, and to check requests and results for safety.</li>
        <li>To prevent fraud and abuse, keep records we are required to keep, and meet legal obligations.</li>
        <li>With your permission, to understand how visitors use the site so we can improve it.</li>
      </ul>
      <p>We do not sell your personal information.</p>
    </>,
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    body: <>
      <p>Some features save information in your browser so they keep working. These are essential and always on:</p>
      <ul>
        <li><strong>Template drafts and orders:</strong> your selected templates, project details and private purchase links, saved in local storage so you can come back to them.</li>
        <li><strong>Free trials:</strong> your private trial link.</li>
        <li><strong>Your cookie choice:</strong> whether you accepted or declined analytics.</li>
      </ul>
      <p><strong>Analytics cookies are optional.</strong> When analytics is enabled on this site, Google Analytics loads only after you choose “Accept analytics” in the cookie banner. It sets cookies that measure visits and page views. You can change your choice at any time with “Cookie settings” in the footer. Analytics never runs in the template store or Neutronium.</p>
      <p>Anyone with your private template link can open that order, so keep it to yourself. Clearing your browser storage removes saved drafts and links from that browser.</p>
    </>,
  },
  {
    id: "providers",
    title: "Service providers",
    body: <>
      <p>We use these providers to run the site. Each processes information only as needed for its service, and some process it outside {company.country}, including in the United States.</p>
      <ul>
        <li><strong>Cloudflare:</strong> hosting, security and storage for saved AI content.</li>
        <li><strong>Stripe:</strong> payments and order records.</li>
        <li><strong>OpenAI:</strong> AI plans, build guides, safety checks and app icons, only after you agree.</li>
        <li><strong>Resend:</strong> delivers contact-form messages to our inbox.</li>
        <li><strong>Google:</strong> analytics, only if you accept analytics cookies.</li>
      </ul>
    </>,
  },
  {
    id: "retention",
    title: "How long we keep information",
    body: <ul>
      <li>Messages: as long as needed to respond and follow up.</li>
      <li>Orders and payment records: as long as needed to provide your purchase and meet accounting and legal requirements.</li>
      <li>Saved AI content: until you delete it. Cloudflare may keep backup copies for a short recovery period.</li>
      <li>Browser storage: until you clear it or delete it in the page.</li>
    </ul>,
  },
  {
    id: "choices",
    title: "Your choices and rights",
    body: <>
      <p>You can ask to access or correct the personal information we hold about you, ask us to delete it, or withdraw consent you gave earlier. Email {email} and we’ll respond. We may need to confirm the request is yours, and we may keep information we are legally required to keep.</p>
      <p>You can also delete saved AI content from your templates page, clear your browser storage, and change your cookie choice with “Cookie settings”. If you have concerns we haven’t resolved, you can contact the <a href="https://www.priv.gc.ca/en/">Office of the Privacy Commissioner of Canada</a>.</p>
    </>,
  },
  {
    id: "security",
    title: "Security",
    body: <p>We use HTTPS, strict security headers in the template store and private, hard-to-guess links for purchases. No method of transmission or storage is completely secure, so please don’t send passwords, payment details or private links in messages.</p>,
  },
  {
    id: "children",
    title: "Children",
    body: <p>This website and the template store are not directed at children under 13, and we do not knowingly collect their personal information. If you believe a child has sent us information, email {email} and we’ll delete it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>When we change this policy, we’ll update the date at the top of the page. For significant changes, we’ll make the update clear on the site.</p>,
  },
  {
    id: "contact",
    title: "Contact us",
    body: <>
      <p>Questions about privacy? Email {email} or use our <Link href="/contact/">contact form</Link>.</p>
      {company.mailingAddress && <p>Mail: {company.mailingAddress}</p>}
    </>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      file="privacy-policy.txt"
      eyebrow="Privacy"
      title="Privacy policy"
      updated={updated}
      intro={<p>What we collect on runsit.ca, why we collect it, who helps us process it, and the choices you have.</p>}
      sections={sections}
    />
  );
}
