"use client";
import { CONSENT_OPEN_EVENT } from "@/lib/analytics";

export function CookieSettingsButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      Cookie settings
    </button>
  );
}
