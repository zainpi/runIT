import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/services", "/case-studies", "/about", "/contact", "/book"];
  const now = new Date();

  const entries: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${site.url}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/book" ? 0.9 : 0.7,
  }));

  // Ancient Horizon: static landing page served on the runs-it.com Worker domain.
  entries.push({
    url: "https://runs-it.com/ancient-horizon",
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  });

  return entries;
}
