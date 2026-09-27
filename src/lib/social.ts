// A page-level openGraph object replaces the root one, so pages that set their own
// share text reuse the site share image explicitly.
const size = { width: 1200, height: 630 };

export const siteSocialImage = {
  url: "/social/runsit.png",
  ...size,
  alt: "runsIT — Explore our products and build your own with AI templates",
};

export const templatesSocialImage = {
  url: "/social/templates.png",
  ...size,
  alt: "runsIT AI templates — build your own app with beginner-friendly AI templates",
};

export function founderSocialImage(slug: string) {
  return { url: `/social/${slug}.png`, ...size, alt: "A runsIT co-founder's portfolio" };
}
