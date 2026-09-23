import { DEFAULT_TEMPLATE_CURRENCY, templateCurrencyForHostname } from "@/lib/templates/catalog";
import { jsonResponse, storeConfiguration, storeRequestOrigin } from "@/lib/templates/server";
import { aiConfiguration } from "@/lib/templates/ai-service";
import { iconConfiguration } from "@/lib/templates/icon-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = await storeConfiguration();
  const ai = await aiConfiguration();
  const aiReady = ai.enabled && !!ai.key && !!ai.model && !!ai.orders;
  const icon = await iconConfiguration();
  try {
    const origin = storeRequestOrigin(request, config.origin);
    return jsonResponse({ available: config.ready && aiReady, appIconAvailable: config.ready && icon.enabled && !!icon.orders, testMode: config.testMode, currency: templateCurrencyForHostname(new URL(origin).hostname) });
  } catch {
    return jsonResponse({ available: false, appIconAvailable: false, testMode: config.testMode, currency: DEFAULT_TEMPLATE_CURRENCY });
  }
}
