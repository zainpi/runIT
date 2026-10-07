import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";

const updated = "2026-10-07";
const title = "BoulderMe Terms of Use";
const description = "The terms for using BoulderMe, the iPhone app for finding bouldering partners in Ontario: who can use it, how to treat other climbers, safety and your content.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/boulderme/terms/" },
  openGraph: { type: "website", url: "/boulderme/terms/", siteName: site.name, title: `${title} | ${site.name}`, description, locale: "en_CA", images: [siteSocialImage] },
  twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [siteSocialImage] },
};

const email = <a href={`mailto:${site.email}`}>{site.email}</a>;

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: <>
      <p>These terms apply when you use BoulderMe, an iPhone app from {site.name}. By creating an account or using the app, you agree to them and to the <Link href="/boulderme/privacy/">BoulderMe privacy policy</Link>. If you got the app from the App Store, Apple&apos;s <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">standard licence terms</a> also apply; Apple is not responsible for BoulderMe or its support.</p>
    </>,
  },
  {
    id: "who-can-use",
    title: "Who can use BoulderMe",
    body: <ul>
      <li>You must be 18 or older.</li>
      <li>You need a Sign in with Apple account, and one BoulderMe account per person.</li>
      <li>You must not use BoulderMe if we have removed you before, or if the law doesn&apos;t allow you to.</li>
    </ul>,
  },
  {
    id: "your-profile",
    title: "Your profile and content",
    body: <>
      <p>Keep your profile honest. Your grades, styles, gyms and whether you have a membership or guest pass are self-reported, and we don&apos;t verify them. Other members rely on them to decide whether to climb with you.</p>
      <p>You own what you write. You give us permission to store it and show it to other members as the app describes, only to run BoulderMe. That permission ends when you delete the content or your account, except for copies kept as the privacy policy describes, such as reported messages.</p>
    </>,
  },
  {
    id: "conduct",
    title: "How to treat other climbers",
    body: <>
      <p>BoulderMe is for finding climbing partners. Please don&apos;t:</p>
      <ul>
        <li>harass, threaten, demean or pressure anyone, including after they decline or block you;</li>
        <li>send sexual content, hate, or content that is illegal or harmful;</li>
        <li>impersonate someone or misrepresent who you are;</li>
        <li>use BoulderMe for dating, selling, advertising or recruiting;</li>
        <li>share someone else&apos;s personal information or chat messages without permission;</li>
        <li>scrape, automate, reverse engineer or overload the service, or get around blocks, limits or access controls.</li>
      </ul>
      <p>Block and report anyone who makes you uncomfortable. We review reports and may warn members, remove content, or suspend or close accounts that break these terms.</p>
    </>,
  },
  {
    id: "safety",
    title: "Climbing and meeting safely",
    body: <>
      <p>Climbing has real risk of injury. You are responsible for your own climbing, your gym&apos;s rules and any waiver it requires. BoulderMe doesn&apos;t screen members, run background checks or supervise meetups.</p>
      <p>Meet at the gym, in public, and tell someone where you&apos;ll be. Leave whenever you feel unsafe. In an emergency, call 911.</p>
    </>,
  },
  {
    id: "gyms",
    title: "Gyms",
    body: <p>Gyms listed in BoulderMe are independent businesses. They are not affiliated with BoulderMe and don&apos;t endorse it. Gym details may be out of date; check with the gym for hours, prices and access.</p>,
  },
  {
    id: "ending",
    title: "Ending your account",
    body: <p>You can delete your account at any time in Settings. We may suspend or close an account that breaks these terms or puts others at risk, and we may change or stop BoulderMe. If we stop the service, we&apos;ll give notice in the app where we can.</p>,
  },
  {
    id: "responsibility",
    title: "Our responsibility",
    body: <>
      <p>BoulderMe is free and provided &ldquo;as is&rdquo;. We work to keep it running and safe, but we don&apos;t promise it will be uninterrupted or error-free, or that other members are who they say they are. We are not responsible for how other members act, online or in person.</p>
      <p>To the extent the law allows, we are not liable for indirect or consequential losses, or for injuries or losses arising from climbing or meeting other members. Nothing in these terms limits rights you have under consumer protection law that can&apos;t be limited.</p>
    </>,
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of Ontario and the federal laws of Canada that apply there.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: <p>We may update these terms and will change the date above. If a change is significant, we&apos;ll let you know in the app. Questions: {email}.</p>,
  },
];

export default function BoulderMeTermsPage() {
  return (
    <LegalPage
      file="boulderme-terms.txt"
      eyebrow="Terms"
      title={title}
      updated={updated}
      intro={<p>BoulderMe helps adult climbers in Ontario find bouldering partners at the gyms they already climb at. These terms keep it useful and safe for everyone.</p>}
      sections={sections}
    />
  );
}
