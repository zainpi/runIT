import { headers } from "next/headers";
import { DEFAULT_TEMPLATE_CURRENCY, templateCurrencyForHostname } from "./catalog";

export async function requestTemplateCurrency() {
  const host = (await headers()).get("host");
  try { return templateCurrencyForHostname(new URL(`https://${host}`).hostname); }
  catch { return DEFAULT_TEMPLATE_CURRENCY; }
}
