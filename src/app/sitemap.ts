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

  // The Last Echo: static pages served on the runs-it.com Worker domain.
  const ahPages = [
    { path: "/the-last-echo", priority: 0.5 },
    { path: "/the-last-echo/support.html", priority: 0.4 },
    { path: "/the-last-echo/privacy.html", priority: 0.3 },
    { path: "/the-last-echo/terms.html", priority: 0.3 },
  ];
  for (const p of ahPages) {
    entries.push({
      url: `https://runs-it.com${p.path}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: p.priority,
    });
  }

  return entries;
}
