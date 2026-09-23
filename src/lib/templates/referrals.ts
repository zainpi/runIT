import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { founders } from "../company";
import { TEMPLATE_REFERRAL_DISCOUNT_PERCENT } from "./catalog";

// The shareable codes stay server-side. Their digests are enough to validate
// checkout and keep the codes out of public JavaScript assets.
const referrals = [
  { founderSlug: "zainpi", codeDigest: "7e03adab7d80b9ea8ece99306da28e4b8c227cfb9f8b460b3a1e17cc748639e0" },
  { founderSlug: "raishaikh", codeDigest: "bd6b5aeb74270c66eb6bc26657194606691217b560b149bfd92f5fe3f48f8f41" },
  { founderSlug: "mikaelsid", codeDigest: "0b813083b6cffa984b50f0801c25eb8e82d65e4bc7bd1f30ee4776bcf23c1d8e" },
] as const;

export type TemplateReferral = {
  founderSlug: (typeof referrals)[number]["founderSlug"];
  founderName: string;
  codeDigest: string;
  discountPercent: typeof TEMPLATE_REFERRAL_DISCOUNT_PERCENT;
};

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9-]{4,40}$/.test(normalized) ? normalized : null;
}

function withFounder(entry: (typeof referrals)[number]): TemplateReferral {
  const founder = founders.find((person) => person.slug === entry.founderSlug);
  if (!founder) throw new Error("Referral founder configuration is invalid.");
  return {
    founderSlug: entry.founderSlug,
    founderName: founder.name,
    codeDigest: entry.codeDigest,
    discountPercent: TEMPLATE_REFERRAL_DISCOUNT_PERCENT,
  };
}

export function referralForCode(value: unknown): TemplateReferral | null {
  const normalized = normalizeReferralCode(value);
  if (!normalized) return null;
  const digest = createHash("sha256").update(normalized).digest();
  const entry = referrals.find((candidate) => {
    const expected = Buffer.from(candidate.codeDigest, "hex");
    return expected.length === digest.length && timingSafeEqual(expected, digest);
  });
  return entry ? withFounder(entry) : null;
}

export function referralForMetadata(founderSlug: unknown, codeDigest: unknown, discountPercent: unknown): TemplateReferral | null {
  if (typeof founderSlug !== "string" || typeof codeDigest !== "string" || discountPercent !== String(TEMPLATE_REFERRAL_DISCOUNT_PERCENT)) return null;
  const entry = referrals.find((candidate) => candidate.founderSlug === founderSlug && candidate.codeDigest === codeDigest);
  return entry ? withFounder(entry) : null;
}
