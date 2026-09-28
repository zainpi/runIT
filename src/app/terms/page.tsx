import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { company } from "@/lib/company";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";
import { AI_MESSAGE_LIMIT } from "@/lib/templates/ai-contract";
import { ICON_UPDATE_LIMIT } from "@/lib/templates/icon-contract";
import { TRIAL_MESSAGE_LIMIT } from "@/lib/templates/trial-contract";

const updated = "2026-09-25";
const title = "Terms and conditions";
const description = "The terms for using runsit.ca and runs-it.com and for buying runsIT AI templates: what’s included, payment, access, your projects and our responsibilities.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms/" },
  openGraph: { type: "website", url: "/terms/", siteName: site.name, title: `${title} | ${site.name}`, description, locale: "en_CA", images: [siteSocialImage] },
  twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [siteSocialImage] },
};

const email = <a href={`mailto:${site.email}`}>{site.email}</a>;

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: <>
      <p>These terms apply when you use runsit.ca or runs-it.com and when you buy AI templates from runsIT, an independent software company in {company.country}. By using the site or completing a purchase, you agree to them.</p>
      <p>Our products have their own terms, which apply when you use them: the <a href="/pulsedeals/terms.html">PulseDeals terms of use</a>, <a href="/the-last-echo/terms.html">The Last Echo terms of service</a> and the <a href="/local-lore/terms.html">Local Lore terms</a>. Build Your Room is played on Roblox under Roblox’s terms.</p>
    </>,
  },
  {
    id: "site",
    title: "Using the website",
    body: <>
      <p>Use the site lawfully and in a way that doesn’t harm it or other people. Please don’t:</p>
      <ul>
        <li>try to get around usage limits, access controls or payment;</li>
        <li>copy, scrape or share paid template content, or other people’s private links;</li>
        <li>use the AI tools to request harmful or unlawful content, or to extract hidden instructions;</li>
        <li>interfere with the site’s operation or security.</li>
      </ul>
      <p>We may limit or suspend access that breaks these rules.</p>
    </>,
  },
  {
    id: "templates",
    title: "What an AI template includes",
    body: <>
      <p>An AI template is digital content that helps you plan and build a project with your own AI tool. Each template you buy includes:</p>
      <ul>
        <li>a detailed build prompt for your coding AI;</li>
        <li>one AI overview of your idea; and</li>
        <li>one complete build guide: a downloadable HTML file with steps, official resources, a detailed specification and a clickable prototype that uses sample data.</li>
      </ul>
      <p>Each order also includes {AI_MESSAGE_LIMIT} AI editing messages shared across the templates in that order. Regenerating a guide uses one message; failed attempts don’t. Optional extras are charged once per order: an app icon (one icon and {ICON_UPDATE_LIMIT} updates), an AI teamwork prompt and a skills and tools setup guide.</p>
      <p>A free-trial code gives you a short plan and {TRIAL_MESSAGE_LIMIT} AI edits for one template. It does not include the full guide or prompts.</p>
      <p><strong>A template is not a development service.</strong> You, with your AI tool, build and run the project. The prototype in the guide is a demonstration and does not include a working backend.</p>
    </>,
  },
  {
    id: "payment",
    title: "Prices and payment",
    body: <>
      <p>Prices are shown on the <Link href="/templates/">AI templates page</Link> before you pay: in Canadian dollars on runsit.ca and in US dollars on runs-it.com. Payment is a one-time charge processed by Stripe; the total shown at checkout is the amount you pay. Discount codes apply only as shown before payment.</p>
      <p>Your coding AI, hosting, domains, app store accounts and other third-party services are not included and may cost extra.</p>
    </>,
  },
  {
    id: "access",
    title: "Access to your purchase",
    body: <>
      <p>After checkout you get a private link to your templates. Save it: anyone with the link can open your order, so don’t share it. If you lose it, email {email} with your order details and we’ll help where we can.</p>
      <p>If a payment is refunded or disputed, access to that order ends.</p>
    </>,
  },
  {
    id: "problems",
    title: "If something goes wrong",
    body: <p>If your order doesn’t work as described, email {email} and we’ll work with you to put it right. Nothing in these terms limits rights you have under consumer protection laws that apply to you.</p>,
  },
  {
    id: "ownership",
    title: "Your projects and our content",
    body: <>
      <p><strong>Your project is yours.</strong> We don’t claim ownership of the apps, games or other projects you build with a template, or of the ideas and details you enter.</p>
      <p>The template content — prompts, guides, prototypes and extras — remains ours. When you buy a template, you may use it to build and operate your own projects, including commercial ones. You may not resell, republish or share the template content itself.</p>
    </>,
  },
  {
    id: "ai",
    title: "AI output and third-party services",
    body: <>
      <p>AI-generated plans, guides, code suggestions and icons can be incomplete or wrong. Review and test everything before you rely on it. You’re responsible for your project, including its security, privacy practices, app store and platform rules, and the laws that apply to it.</p>
      <p>Third-party tools you use with a template — AI models, hosting, databases, payment and app stores — have their own terms and costs, which you agree to with those providers.</p>
    </>,
  },
  {
    id: "launch-help",
    title: "Launch help",
    body: <p>If you ask us to host or manage a project for you, we’ll send a separate quote first. That work is covered by the terms we agree for it, not by a template purchase.</p>,
  },
  {
    id: "liability",
    title: "Our responsibility",
    body: <>
      <p>We work to keep the site and templates accurate and available, but we provide them as they are and can’t promise they will be uninterrupted or error-free, or that a project built with them will succeed.</p>
      <p>To the extent the law allows, runsIT is not liable for indirect or consequential losses, and our total liability for a purchase is limited to the amount you paid for it.</p>
    </>,
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>We may update these terms and will change the date at the top when we do. A purchase is covered by the terms in effect when you made it.</p>,
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of {company.country} and of the province in which runsIT operates.</p>,
  },
  {
    id: "contact",
    title: "Contact us",
    body: <>
      <p>Questions about these terms? Email {email} or use our <Link href="/contact/">contact form</Link>.</p>
      {company.mailingAddress && <p>Mail: {company.mailingAddress}</p>}
    </>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      file="terms.txt"
      eyebrow="Terms"
      title="Terms and conditions"
      updated={updated}
      intro={<p>The rules for using this site and for buying and using runsIT AI templates, in plain language.</p>}
      sections={sections}
    />
  );
}
