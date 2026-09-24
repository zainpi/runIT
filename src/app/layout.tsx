import type { Metadata } from "next";
import { Figtree, Gochi_Hand, Inter, Pixelify_Sans, Sora } from "next/font/google";
import "./globals.css";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { site, siteOpenGraph } from "@/lib/site";
import { founders } from "@/lib/company";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

// runsOS typefaces for the company site, store and portfolios.
const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-os-sans",
});

const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-os-pixel",
});

const gochiHand = Gochi_Hand({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  preload: false,
  variable: "--font-os-hand",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: [
    "runsIT",
    "Canadian software company",
    "AI app templates",
    "build your own app",
    "apps and games",
    "Neutronium",
    "PulseDeals",
    "The Last Echo",
  ],
  authors: [{ name: site.legalName }],
  creator: site.legalName,
  publisher: site.legalName,
  alternates: { canonical: "/" },
  openGraph: {
    ...siteOpenGraph,
    url: site.url,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "technology",
};

export const viewport = {
  themeColor: "#ede4d3",
  width: "device-width",
  initialScale: 1,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.legalName,
  url: site.url,
  logo: `${site.url}/icon.svg`,
  description: site.description,
  email: site.email,
  founder: founders.map((founder) => ({
    "@type": "Person",
    name: founder.name,
    url: `${site.url}${founder.portfolioUrl}`,
  })),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${figtree.variable} ${pixelify.variable} ${gochiHand.variable}`}>
      {/* Browser tooling can add body attributes (for example, vc-init) before hydration.
          Limit suppression to this element; descendants retain hydration checks. */}
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[10px] focus:border-2 focus:border-[#1b1a17] focus:bg-[#ffd23f] focus:px-4 focus:py-2 focus:font-bold focus:text-[#1b1a17] focus:shadow-[4px_4px_0_#1b1a17] focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          Skip to content
        </a>
        <SiteFrame>{children}</SiteFrame>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
      </body>
    </html>
  );
}
