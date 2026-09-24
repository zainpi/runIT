import type { Metadata } from "next";
import { headers } from "next/headers";
import { DEFAULT_TEMPLATE_CURRENCY, templateCurrencyForHostname } from "@/lib/templates/catalog";
import { siteOpenGraph } from "@/lib/site";
import { TemplateStore } from "./store";
export const dynamic = "force-dynamic";

async function requestCurrency() {
  const host = (await headers()).get("host");
  try { return templateCurrencyForHostname(new URL(`https://${host}`).hostname); }
  catch { return DEFAULT_TEMPLATE_CURRENCY; }
}

export async function generateMetadata(): Promise<Metadata> {
  const currency = (await requestCurrency()).toUpperCase();
  const title = "AI templates — build your own app";
  const description = `Build your own app with beginner-friendly AI templates and simple, guided steps. No coding experience needed to get started. From $9.99 ${currency}.`;
  return {
    title,
    description,
    alternates: { canonical: "/templates/" },
    openGraph: { ...siteOpenGraph, title: `${title} | runsIT`, description, url: "/templates/" },
    twitter: { card: "summary_large_image", title: `${title} | runsIT`, description },
  };
}
export default async function TemplatesPage() { return <TemplateStore initialCurrency={await requestCurrency()} />; }
