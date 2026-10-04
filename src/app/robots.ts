import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      // The wildcard permits Googlebot and AI search crawlers (including
      // OAI-SearchBot, PerplexityBot and Claude-SearchBot) with the same limits.
      // Separate agent groups do not inherit wildcard disallows.
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/neutronium", "/templates/library", "/templates/trial", "/the-last-echo/admin"],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
