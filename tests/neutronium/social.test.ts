import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { verifyIdentityToken } from "../../src/lib/neutronium/identity-token";
test("social tokens reject wrong issuer, audience, nonce, signature and expiry", async () => {
  const keys = await generateKeyPair("RS256");
  const jwk = await exportJWK(keys.publicKey);
  const resolve = createLocalJWKSet({
    keys: [{ ...jwk, kid: "test", alg: "RS256" }],
  });
  const expected = {
    issuer: "https://issuer.example",
    audience: "client",
    nonce: "nonce",
  };
  const sign = (expiry: string, key = keys.privateKey) =>
    new SignJWT({ nonce: "nonce" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("stable-id")
      .setIssuer(expected.issuer)
      .setAudience(expected.audience)
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(key);
  const token = await sign("5m");
  assert.equal(
    (await verifyIdentityToken(token, resolve, expected)).sub,
    "stable-id",
  );
  for (const change of [
    { issuer: "https://attacker.example" },
    { audience: "other" },
    { nonce: "other" },
  ])
    await assert.rejects(
      verifyIdentityToken(token, resolve, { ...expected, ...change }),
    );
  await assert.rejects(
    verifyIdentityToken(await sign("-1s"), resolve, expected),
  );
  const other = await generateKeyPair("RS256");
  await assert.rejects(
    verifyIdentityToken(await sign("5m", other.privateKey), resolve, expected),
  );
});
