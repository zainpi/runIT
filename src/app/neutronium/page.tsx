import type { Metadata } from "next";
import { Neutronium } from "./workspace";
import "./neutronium.css";

const neutroniumTitle = "Neutronium — Your people. Their access. Under control.";
const neutroniumDescription =
  "A simpler workspace for company IT. Manage onboarding, employee access, and offboarding in one place.";
const neutroniumUrl = "https://neutronium.runsit.ca/neutronium/";
const neutroniumImage =
  "https://neutronium.runsit.ca/neutronium/opengraph-image/";

export const metadata: Metadata = {
  title: neutroniumTitle,
  description: neutroniumDescription,
  alternates: { canonical: neutroniumUrl },
  openGraph: {
    type: "website",
    url: neutroniumUrl,
    siteName: "Neutronium",
    title: neutroniumTitle,
    description: neutroniumDescription,
    images: [
      {
        url: neutroniumImage,
        width: 1200,
        height: 630,
        alt: "Neutronium — People, access, and onboarding in one place",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: neutroniumTitle,
    description: neutroniumDescription,
    images: [neutroniumImage],
  },
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Neutronium />;
}
