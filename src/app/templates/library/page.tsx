import type { Metadata } from "next";
import { siteOpenGraph } from "@/lib/site";
import { TemplateLibrary } from "./library";
export const metadata: Metadata = {
  title: "My templates",
  description: "Your purchased runsIT templates, plans and build files.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: { ...siteOpenGraph, title: "My templates | runsIT", description: "Your purchased runsIT templates, plans and build files.", url: "/templates/library/" },
  twitter: { card: "summary_large_image", title: "My templates | runsIT", description: "Your purchased runsIT templates, plans and build files." },
};
export default function LibraryPage() { return <TemplateLibrary />; }
