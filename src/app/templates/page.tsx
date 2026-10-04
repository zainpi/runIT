import type { Metadata } from "next";
import { requestTemplateCurrency } from "@/lib/templates/request-currency";
import { siteOpenGraph } from "@/lib/site";
import { templatesSocialImage } from "@/lib/social";
import { TemplateStore } from "./store";
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const currency = (await requestTemplateCurrency()).toUpperCase();
  const title = "AI app and game templates — build your own with guided prompts";
  const description = `Build an iPhone app, Discord bot, Roblox game, mobile game, online store or browser game with runsIT AI templates. Guided prompts and build plans from $9.99 ${currency}.`;
  return {
    title,
    description,
    alternates: { canonical: "/templates/" },
    openGraph: { ...siteOpenGraph, title: `${title} | runsIT`, description, url: "/templates/", images: [templatesSocialImage] },
    twitter: { card: "summary_large_image", title: `${title} | runsIT`, description, images: [templatesSocialImage] },
  };
}
export default async function TemplatesPage() { return <TemplateStore initialCurrency={await requestTemplateCurrency()} />; }
