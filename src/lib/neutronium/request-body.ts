import { DomainError } from "./model";
import { hasControlCharacters } from "./validation";

export const MAX_REQUEST_BYTES = 100_000;

export async function readJsonBody(
  req: Request,
): Promise<Record<string, unknown>> {
  if (
    req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new DomainError("Send the request as JSON.", 415);
  const length = req.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES))
    throw new DomainError("Request too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new DomainError("Invalid JSON.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let raw = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new DomainError("Request too large.", 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError("Could not read the request. Send valid UTF-8 JSON.");
  } finally {
    reader.releaseLock();
  }
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new DomainError("Invalid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new DomainError("Send a JSON object.");
  let nodes = 0;
  function validate(value: unknown, depth = 0) {
    if (++nodes > 10_000 || depth > 20)
      throw new DomainError("Request is too complex.");
    if (typeof value === "string" && hasControlCharacters(value))
      throw new DomainError(
        "Remove unsupported control characters from your input.",
      );
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new DomainError("Unsupported input field.");
        validate(child, depth + 1);
      }
    }
  }
  validate(input);
  return input as Record<string, unknown>;
}
