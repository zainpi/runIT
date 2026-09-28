// Optional Google Analytics 4. Nothing loads until a visitor accepts analytics cookies.
export const gaMeasurementId = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim();
export const analyticsConfigured = /^G-[A-Z0-9]{4,}$/.test(gaMeasurementId);

export const CONSENT_STORAGE_KEY = "runsit-consent-v1";
export const CONSENT_OPEN_EVENT = "runsit:open-consent";
export type ConsentChoice = "granted" | "denied";

// The template store and Neutronium send strict security headers and handle private
// purchases or company data, so optional third-party scripts never run there.
export function optionalScriptsAllowed(path: string) {
  return !["/templates", "/neutronium", "/the-last-echo/admin"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
