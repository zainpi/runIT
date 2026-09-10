import { DomainError } from "./model";
export const validJoinToken = (token: unknown): token is string =>
  typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
export function joinPath(token: string) {
  if (!validJoinToken(token))
    throw new DomainError(
      "This invitation is invalid. Ask your administrator for a new link.",
      404,
    );
  return `/neutronium/join/?token=${token}`;
}
export function safeAuthReturn(value: unknown) {
  return typeof value === "string" &&
    /^\/neutronium\/join\/\?token=[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : "/neutronium/?view=profile";
}
