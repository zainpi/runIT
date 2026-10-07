import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { company } from "@/lib/company";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";

const updated = "2026-10-07";
const title = "BoulderMe Privacy Policy";
const description = "What BoulderMe stores to help adult climbers in Ontario find bouldering partners, who can see it, how long it is kept, and how to export or delete it.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/boulderme/privacy/" },
  openGraph: { type: "website", url: "/boulderme/privacy/", siteName: site.name, title: `${title} | ${site.name}`, description, locale: "en_CA", images: [siteSocialImage] },
  twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [siteSocialImage] },
};

const email = <a href={`mailto:${site.email}`}>{site.email}</a>;

const sections: LegalSection[] = [
  {
    id: "what-we-collect",
    title: "What we collect",
    body: <>
      <p>BoulderMe collects only what it needs to help you find someone to climb with:</p>
      <ul>
        <li><strong>Sign in with Apple:</strong> we keep a one-way hash of your Apple user identifier to recognize your account, and an encrypted Apple token used only to revoke Apple sign-in when you delete your account. We do not store your email address. If Apple shares your first name, it pre-fills your display name and is not kept separately.</li>
        <li><strong>Your profile:</strong> display name, grade range, climbing styles and a short intro.</li>
        <li><strong>Your gyms:</strong> the gyms you climb at and whether you have a membership or use guest passes. This is self-reported and shown as such.</li>
        <li><strong>Your availability:</strong> the weekly times you usually climb.</li>
        <li><strong>Invitations and chats:</strong> the gym, time and note in invitations you send, and messages you write.</li>
        <li><strong>Safety records:</strong> people you block, and reports you make, including a copy of a reported message.</li>
        <li><strong>Gym suggestions</strong> you send us.</li>
        <li><strong>Confirmations:</strong> that you are 18 or older, and which onboarding steps you finished.</li>
        <li><strong>Technical records:</strong> sign-in sessions, a random installation identifier (hashed, for rate limiting), the date you were last active, and request logs (request id, route, status and timing, with no message content, tokens or names).</li>
      </ul>
      <p>BoulderMe does not use location services or GPS, and does not access your contacts or photos. It has no advertising or analytics SDKs and does not track you across apps or websites.</p>
    </>,
  },
  {
    id: "who-sees-what",
    title: "Who can see what",
    body: <>
      <ul>
        <li>While discovery is on, other signed-in members can see your display name, grades, styles, intro, gyms and access type, and availability. The app shows you this before you turn discovery on.</li>
        <li>Others see only that you were &ldquo;active recently&rdquo; (within 14 days), never a date.</li>
        <li>Invitations are visible to the sender and recipient. Chat messages are visible to the two people in the chat.</li>
        <li>Blocks are visible only to you. Someone you block can no longer see you or contact you.</li>
        <li>Reports and gym suggestions are seen only by us. A reported member is never told who reported them.</li>
      </ul>
      <p>You can pause discovery at any time in Settings. You disappear from discovery and can&apos;t receive new invitations, and open chats stay open.</p>
    </>,
  },
  {
    id: "how-we-use",
    title: "How we use information",
    body: <>
      <p>We use this information only to run BoulderMe: to sign you in, match climbers by gym, grade and time, deliver invitations and messages, keep members safe, review reports, and keep the service secure. We do not sell personal information or use it for advertising.</p>
    </>,
  },
  {
    id: "providers",
    title: "Service providers",
    body: <>
      <p>We use these providers to run BoulderMe. Each processes information only as needed for its service, and some process it outside {company.country}, including in the United States.</p>
      <ul>
        <li><strong>Apple:</strong> Sign in with Apple.</li>
        <li><strong>Cloudflare:</strong> hosting for the BoulderMe service and request logs.</li>
        <li><strong>Supabase:</strong> database hosting.</li>
      </ul>
    </>,
  },
  {
    id: "on-your-iphone",
    title: "On your iPhone",
    body: <>
      <p>Your sign-in session is kept in the iOS Keychain on this device only. The app keeps a cache of your account so it works offline; it is cleared when you sign out or switch accounts. A random installation identifier stays until you delete the app. Demo mode uses made-up data and never contacts our servers.</p>
    </>,
  },
  {
    id: "retention",
    title: "How long we keep information",
    body: <ul>
      <li>Profile, gyms and availability: until you change or remove them, or delete your account.</li>
      <li>Invitations and chats: until either person deletes their account. Your messages are deleted with your account, and the other person sees &ldquo;Deleted climber&rdquo;.</li>
      <li>Reports: one year after they are resolved, then deleted. They are kept through account deletion so abuse can still be reviewed.</li>
      <li>Gym suggestions: one year.</li>
      <li>Expired sign-in sessions: deleted after 30 days.</li>
      <li>Request logs: Cloudflare&apos;s standard retention.</li>
    </ul>,
  },
  {
    id: "your-controls",
    title: "Your controls",
    body: <>
      <ul>
        <li>Edit or remove any part of your profile, gyms or availability in the app.</li>
        <li>Pause discovery in Settings.</li>
        <li>Use <strong>Export my data</strong> in Settings to get a file with your profile, gyms, availability, invitations, chats, blocks and reports.</li>
        <li>Use <strong>Delete account</strong> in Settings. Sign-in is blocked and you are hidden right away; your profile, gyms, availability, blocks, suggestions and sent messages are deleted, open invitations are cancelled, chats are closed, and your sessions and Apple sign-in are revoked. A hash of your Apple identifier is kept so a deleted account isn&apos;t silently recreated.</li>
      </ul>
      <p>You can also ask to access or correct your information, or ask us to delete it, by emailing {email}. If you have concerns we haven&apos;t resolved, you can contact the <a href="https://www.priv.gc.ca/en/">Office of the Privacy Commissioner of Canada</a>.</p>
    </>,
  },
  {
    id: "age",
    title: "Adults only",
    body: <p>BoulderMe is for people 18 and older. We do not knowingly collect information from anyone younger. If you believe a minor is using BoulderMe, report the profile in the app or email {email}.</p>,
  },
  {
    id: "security",
    title: "Security",
    body: <p>BoulderMe uses HTTPS, short-lived access tokens, encrypted Apple tokens and hashed identifiers. No method of transmission or storage is completely secure, so please don&apos;t share passwords or payment details in chats.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: <p>We&apos;ll update this page when BoulderMe changes what it collects, and change the date above. Questions: {email}.</p>,
  },
];

export default function BoulderMePrivacyPage() {
  return (
    <LegalPage
      file="boulderme-privacy-policy.txt"
      eyebrow="Privacy"
      title={title}
      updated={updated}
      intro={<p>BoulderMe is an iPhone app from {site.name} that helps adult climbers in Ontario find bouldering partners at the gyms they already climb at. This policy explains what BoulderMe stores, who can see it and how you control it.</p>}
      sections={sections}
    />
  );
}
