export class RequestError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfterSeconds = 0,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

const pending = new Map<string, { promise: Promise<any>; read: boolean }>();
const cooldowns = new Map<string, number>();

async function send(url: string, init: RequestInit = {}) {
  const mutation = !["GET", "HEAD"].includes(
    (init.method || "GET").toUpperCase(),
  );
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    mutation ? 60_000 : 30_000,
  );
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new Error("Request aborted");
    if (
      !response.ok ||
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      let retryAfter = 0;
      if (response.status === 429) {
        const header = response.headers.get("retry-after") || "60";
        retryAfter = Math.max(
          1,
          Math.min(
            3600,
            /^\d+$/.test(header)
              ? Number(header)
              : Math.ceil((Date.parse(header) - Date.now()) / 1000) || 60,
          ),
        );
        cooldowns.set(url, Date.now() + retryAfter * 1000);
      }
      const fallback =
        response.status === 429
          ? `Too many attempts. Wait ${retryAfter} seconds, then try again.`
          : response.status === 401
            ? "Your session has expired. Sign in again to continue."
            : response.status === 404
              ? "This page or action couldn’t be found. Refresh Neutronium and try again."
              : "Neutronium couldn’t complete this request. Please try again in a few minutes.";
      throw new RequestError(
        typeof result?.error === "string"
          ? result.error.slice(0, 2000)
          : fallback,
        response.status,
        retryAfter,
      );
    }
    if (mutation) {
      // A refresh after a save must not reuse a read started before that save.
      for (const [key, entry] of pending) if (entry.read) pending.delete(key);
    }
    return result;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (timedOut)
      throw new RequestError(
        mutation
          ? "This request took too long. It may have been saved. Refresh and check the result before submitting again."
          : "Neutronium took too long to respond. Please try again.",
      );
    if (init.signal?.aborted) throw new RequestError("Request cancelled.");
    throw new RequestError(
      mutation
        ? "We couldn’t reach Neutronium. Check your connection, then refresh to check whether your changes were saved before trying again."
        : "We couldn’t reach Neutronium. Check your internet connection and try again.",
    );
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}

// Share only requests currently in flight. Mutations are never automatically retried.
export function requestJson(url: string, init: RequestInit = {}): Promise<any> {
  for (const [key, until] of cooldowns)
    if (until <= Date.now()) cooldowns.delete(key);
  const until = cooldowns.get(url);
  if (until) {
    const seconds = Math.ceil((until - Date.now()) / 1000);
    return Promise.reject(
      new RequestError(
        `Too many attempts. Wait ${seconds} seconds, then try again.`,
        429,
        seconds,
      ),
    );
  }
  if (cooldowns.size > 100) cooldowns.delete(cooldowns.keys().next().value!);
  if (init.signal || (init.body != null && typeof init.body !== "string"))
    return send(url, init);
  const key = JSON.stringify([
    url,
    init.method || "GET",
    init.body,
    init.credentials,
    [...new Headers(init.headers).entries()].sort(),
  ]);
  const existing = pending.get(key);
  if (existing) return existing.promise;
  const result = send(url, init).finally(() => {
    if (pending.get(key)?.promise === result) pending.delete(key);
  });
  pending.set(key, {
    promise: result,
    read: ["GET", "HEAD"].includes((init.method || "GET").toUpperCase()),
  });
  return result;
}
