import type { Metadata } from "next";
import { headers } from "next/headers";
import { DEFAULT_TEMPLATE_CURRENCY, templateCurrencyForHostname } from "@/lib/templates/catalog";
import { TemplateStore } from "./store";
export const dynamic = "force-dynamic";

async function requestCurrency() {
  const host = (await headers()).get("host");
  try { return templateCurrencyForHostname(new URL(`https://${host}`).hostname); }
  catch { return DEFAULT_TEMPLATE_CURRENCY; }
}

// Static so the title and description render in the document head for every client.
// Prices are the same number on both domains (CAD on runsit.ca, USD on runs-it.com).
export const metadata: Metadata = {
  title: "AI templates — build your own app",
  description: "Build your own app with beginner-friendly AI templates and simple, guided steps. No coding experience needed to get started. From $9.99.",
  alternates: { canonical: "/templates/" },
};
export default async function TemplatesPage() { return <TemplateStore initialCurrency={await requestCurrency()} />; }
