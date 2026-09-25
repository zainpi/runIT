import { alt, size } from "@/app/opengraph-image";

// A page-level openGraph object replaces the root one, so pages that set their own
// share text reuse the site share image explicitly.
export const siteSocialImage = { url: "/opengraph-image/", ...size, alt };
