import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { founders } from "@/lib/company";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", priority: 1, frequency: "monthly" as const, modified: "2026-09-10" },
    ...founders.map((founder) => ({ path: founder.portfolioUrl, priority: 0.7, frequency: "monthly" as const, modified: "2026-09-10" })),
    { path: "/heaterdeals/", priority: 0.8, frequency: "monthly" as const, modified: "2026-09-10" },
    { path: "/the-last-echo/", priority: 1, frequency: "weekly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/guides/", priority: 0.9, frequency: "weekly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/guides/game-systems-reference.html", priority: 0.9, frequency: "monthly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/gallery.html", priority: 0.8, frequency: "monthly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/guides/how-idle-progression-works.html", priority: 0.7, frequency: "monthly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/guides/fair-gacha-design.html", priority: 0.7, frequency: "monthly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/guides/first-demo-guide.html", priority: 0.7, frequency: "monthly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/devlog/why-we-built-the-last-echo.html", priority: 0.7, frequency: "monthly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/about.html", priority: 0.6, frequency: "monthly" as const, modified: "2026-08-06" },
    { path: "/the-last-echo/support.html", priority: 0.4, frequency: "monthly" as const, modified: "2026-07-21" },
  ];
  return pages.map((page) => ({
    url: `${site.url}${page.path}`,
    lastModified: page.modified,
    changeFrequency: page.frequency,
    priority: page.priority,
  }));
}
