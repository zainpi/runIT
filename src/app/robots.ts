import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/the-last-echo/admin/", "/the-last-echo/admin"],
    },
    sitemap: "https://runs-it.com/sitemap.xml",
    host: "https://runs-it.com",
  };
}
