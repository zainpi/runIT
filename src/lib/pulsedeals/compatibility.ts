/** Upgrade bridge for configured deployments and already-installed clients. */
export function getPulseDealsEnv(
  name: string,
  environment: Record<string, unknown> = process.env,
): string | undefined {
  const legacyName = name.replace(/^PULSEDEALS_/, "HEATERDEALS_");
  const value = environment[name] ?? environment[legacyName];
  return typeof value === "string" ? value : undefined;
}

export function isPulseDealsSessionType(value: unknown): boolean {
  return value === "pulsedeals-session" || value === "heater-session";
}

export function getCronSecretHeader(headers: Headers): string | null {
  return headers.get("x-pulsedeals-cron-secret") ?? headers.get("x-heater-cron-secret");
}

export function renamedPulseDealsPath(pathname: string): string | null {
  if (pathname !== "/heaterdeals" && !pathname.startsWith("/heaterdeals/")) return null;
  return pathname.replace(/^\/heaterdeals(?=\/|$)/, "/pulsedeals");
}
