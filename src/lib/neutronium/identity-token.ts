import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { DomainError } from "./model";
export async function verifyIdentityToken(
  token: string,
  key: JWTVerifyGetKey,
  expected: { issuer: string; audience: string; nonce: string },
) {
  const { payload } = await jwtVerify(token, key, {
    issuer: expected.issuer,
    audience: expected.audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "nonce"],
  });
  if (payload.nonce !== expected.nonce || !payload.sub)
    throw new DomainError("Invalid sign-in token.", 401);
  return payload;
}
