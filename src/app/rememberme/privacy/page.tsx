import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { site } from "@/lib/site";
import { siteSocialImage } from "@/lib/social";

const updated = "2026-09-30";
const title = "RememberMe Privacy Policy";
const description = "RememberMe remembers the Google account you select for a website. It has no server, user registration, analytics, advertising, or tracking: all records stay in your browser.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/rememberme/privacy/" },
  openGraph: { type: "website", url: "/rememberme/privacy/", siteName: site.name, title: `${title} | ${site.name}`, description, locale: "en_CA", images: [siteSocialImage] },
  twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [siteSocialImage] },
};

const sections: LegalSection[] = [
  {
    id: "stays-in-your-browser",
    title: "What stays in your browser",
    body: <>
      <p>RememberMe stores the following in the installed browser profile&apos;s extension-local storage (<code>chrome.storage.local</code> in Chrome, <code>browser.storage.local</code> in Firefox):</p>
      <ul>
        <li>Website/app domain and app display name.</li>
        <li>Most recently selected Google email address for that app.</li>
        <li>First-recorded and last-selected timestamps and selection count.</li>
        <li>Optional public OAuth client identifier and callback hostname, used to identify the app.</li>
        <li>App links you explicitly confirm for sign-ins routed through an intermediary.</li>
        <li>Your reminder, date-display, and auto-select preferences.</li>
      </ul>
      <p>Temporary OAuth context stores only sanitized client identifiers, callback hosts, and timestamps in the browser&apos;s extension-session storage. It is associated with an active Google sign-in tab, expires after a short continuation window, and is removed when that tab closes or leaves Google&apos;s sign-in site. Session storage is also cleared when the browser restarts or the extension is reloaded, disabled, or updated. It contains no tokens or full navigation URLs.</p>
      <p>RememberMe does not use synced storage. It does not automatically send records to other browsers or devices.</p>
    </>,
  },
  {
    id: "never-read-or-stored",
    title: "What is never read or stored",
    body: <>
      <ul>
        <li>Passwords or password-field values.</li>
        <li>Access tokens, refresh tokens, Google ID tokens, authorization codes, or OAuth state.</li>
        <li>Google authentication cookies, session tokens, or other cookies.</li>
        <li>Browsing history or a log of websites you visit.</li>
        <li>Unrelated webpage content, arbitrary website email addresses, or network traffic.</li>
      </ul>
      <p>The content script runs only on <code>https://accounts.google.com/*</code>, in the top frame. It reads account-row email identifiers and limited app-name hints from the traditional chooser, and parses OAuth routing identifiers from Google&apos;s page URL. It does not inspect browser-owned FedCM dialogs. <code>activeTab</code> is used only to identify the current website after you invoke the popup, without scanning that page.</p>
    </>,
  },
  {
    id: "use-and-share",
    title: "How information is used and shared",
    body: <>
      <p>Stored records are used only for RememberMe&apos;s account reminders and local management features. Information is never sold, sent to RememberMe, used for advertising, or transmitted by the extension to a third party. There are no external APIs, remote favicon lookups, or telemetry requests.</p>
      <p>The current app&apos;s reminder is inserted into Google&apos;s sign-in page and is visible to scripts on that page. It includes the app name and, if enabled, the last-selected date. It does not expose records for other apps. The email being highlighted already exists in the account chooser. Google and the website continue their normal sign-in behavior under their own policies; RememberMe does not control their requests. Enabling auto-select activates the visible account row and starts that normal behavior.</p>
      <p>Exporting creates a local JSON file containing your app records, links, and preferences. No upload occurs. Importing reads a file you choose and validates it before merging local records. Import never enables auto-select or changes your current preferences. How you store or share exported backups is under your control.</p>
    </>,
  },
  {
    id: "your-controls",
    title: "Your controls",
    body: <>
      <ul>
        <li>Use <strong>Change</strong> to rename an app or change its remembered email.</li>
        <li>Use <strong>Forget</strong> to delete an app&apos;s account record and manually confirmed links.</li>
        <li>Disable reminders while continuing to remember choices.</li>
        <li>Auto-select is off by default and must be explicitly enabled in settings.</li>
        <li>Use <strong>Clear all data</strong> and confirm to delete every account, link, preference, and temporary sign-in context.</li>
        <li>Disable or uninstall RememberMe to stop all detection. Uninstalling removes extension storage, but does not remove backups you exported.</li>
      </ul>
      <p>Records are retained locally until you delete them or uninstall the extension. Firefox temporary-development installations may retain local data after removal; clear data before removing a temporary add-on if you want it erased. Incognito/private-window use is disabled in version 1.0.1.</p>
    </>,
  },
  {
    id: "security-and-access",
    title: "Security and access",
    body: <>
      <p>RememberMe validates runtime message senders and supplies only the current app&apos;s record to the Google content script. Chrome restricts local and session storage to trusted extension contexts. Firefox does not implement that restriction API: its session storage is private to extension pages by default, and its local storage remains accessible to the extension&apos;s own isolated content scripts. RememberMe&apos;s content script does not read local storage directly. Website scripts cannot access the extension&apos;s storage or messaging APIs.</p>
      <p>Page-provided names and imported strings are treated as text, not executable HTML. All extension code is bundled, and extension pages prohibit network connections through their Content Security Policy.</p>
      <p>RememberMe does not encrypt local data or exported backups. Anyone with access to your browser profile, device, or backup files may be able to read your saved email addresses. Keep exported backups private.</p>
      <p>RememberMe&apos;s use of locally handled information is limited to its account-reminder purpose and follows the Chrome Web Store User Data Policy&apos;s Limited Use restrictions. This extension does not obtain credentials or user information from Google APIs.</p>
    </>,
  },
];

export default function RememberMePrivacyPage() {
  return (
    <LegalPage
      file="rememberme-privacy-policy.txt"
      eyebrow="Privacy"
      title="RememberMe Privacy Policy"
      updated={updated}
      intro={<p>RememberMe remembers the Google account you select for a website and reminds you during a later traditional Google sign-in. It has no server, user registration, analytics, advertising, or tracking system. RememberMe collects no server-side data and sends no network requests.</p>}
      sections={sections}
    />
  );
}
