import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";

const updated = "2026-10-07";
const title = "BoulderMe Support";
const description = "Help with BoulderMe, the iPhone app for finding bouldering partners in Ontario: signing in, discovery, gyms, blocking and reporting, exporting data and deleting your account.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/boulderme/support/" },
  openGraph: { type: "website", url: "/boulderme/support/", siteName: site.name, title: `${title} | ${site.name}`, description, locale: "en_CA", images: [siteSocialImage] },
  twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [siteSocialImage] },
};

const email = <a href={`mailto:${site.email}?subject=BoulderMe%20support`}>{site.email}</a>;

const sections: LegalSection[] = [
  {
    id: "contact",
    title: "Contact us",
    body: <p>Email {email} with &ldquo;BoulderMe&rdquo; in the subject. Tell us what you were doing, what you expected and what happened, plus your iPhone model and iOS version. Please don&apos;t send screenshots of other people&apos;s chats; report them in the app instead.</p>,
  },
  {
    id: "sign-in",
    title: "Signing in",
    body: <>
      <p>BoulderMe uses Sign in with Apple. If sign-in fails, check that you&apos;re signed in to your Apple Account in Settings and that you have a connection, then try again.</p>
      <p>Want to look around first? Choose <strong>Explore the demo</strong> on the welcome screen. Demo data is made up and stays on your iPhone.</p>
    </>,
  },
  {
    id: "discovery",
    title: "Finding partners",
    body: <>
      <p>Add the gyms you climb at and the times you usually climb, then turn on <strong>Show me in discovery</strong>. You&apos;ll see climbers who share a gym with you, and they&apos;ll see you. Send an invitation for a gym and time; once it&apos;s accepted, you can chat.</p>
      <p>To take a break, turn off <strong>Show me in discovery</strong> in Settings. You disappear from discovery and won&apos;t get new invitations. Open chats stay open.</p>
    </>,
  },
  {
    id: "gyms",
    title: "My gym isn't listed",
    body: <p>Search for the gym, then choose <strong>Can&apos;t find it? Suggest a gym</strong>. We review suggestions and add Ontario bouldering gyms to the list.</p>,
  },
  {
    id: "safety",
    title: "Blocking and reporting",
    body: <>
      <p>Open the member&apos;s profile and choose <strong>Block</strong> or <strong>Report</strong>. A blocked member can no longer see or contact you. Reports go only to us, and the member is never told who reported them.</p>
      <p>Meet at the gym, tell someone where you&apos;ll be, and leave if you feel unsafe. In an emergency, call 911. <strong>Safety tips</strong> in Settings has more.</p>
    </>,
  },
  {
    id: "your-data",
    title: "Exporting your data",
    body: <p>In Settings, choose <strong>Export my data</strong>. You get a file with your profile, gyms, availability, invitations, chats, blocks and reports that you can save or share. The <Link href="/boulderme/privacy/">privacy policy</Link> explains what we keep and why.</p>,
  },
  {
    id: "delete",
    title: "Deleting your account",
    body: <>
      <p>In Settings, choose <strong>Delete account</strong> and type DELETE to confirm. Your account is hidden and sign-in is blocked right away, and your profile, gyms, availability and sent messages are deleted. People you chatted with see &ldquo;Deleted climber&rdquo;. This can&apos;t be undone.</p>
      <p>If you can&apos;t open the app, email {email} and we&apos;ll help.</p>
    </>,
  },
];

export default function BoulderMeSupportPage() {
  return (
    <LegalPage
      file="boulderme-support.txt"
      eyebrow="Support"
      title={title}
      updated={updated}
      intro={<p>BoulderMe helps adult climbers in Ontario find bouldering partners at the gyms they already climb at. Here&apos;s help with the most common questions, and how to reach us.</p>}
      sections={sections}
    />
  );
}
