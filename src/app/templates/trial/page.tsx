import type { Metadata } from "next";
import { siteOpenGraph } from "@/lib/site";
import { TemplateTrial } from "./trial";
export const metadata: Metadata = {
  title: "Your free template trial",
  description: "Shape your app idea with a free runsIT template trial.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: { ...siteOpenGraph, title: "Your free template trial | runsIT", description: "Shape your app idea with a free runsIT template trial.", url: "/templates/trial/" },
  twitter: { card: "summary_large_image", title: "Your free template trial | runsIT", description: "Shape your app idea with a free runsIT template trial." },
};
export default function TrialPage() { return <TemplateTrial />; }
