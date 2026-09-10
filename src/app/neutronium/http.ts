export async function requestJson(url: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(
      "We couldn’t reach Neutronium. Check your internet connection and try again.",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const fallback =
      response.status === 429
        ? "Too many attempts. Wait a minute, then try again."
        : response.status === 401
          ? "Your session has expired. Sign in again to continue."
          : response.status === 404
            ? "This page or action couldn’t be found. Refresh Neutronium and try again."
            : "Neutronium couldn’t complete this request. Please try again in a few minutes.";
    throw new Error(
      typeof result?.error === "string" ? result.error : fallback,
    );
  }
  return result;
}
