import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = [
    { path: "/the-last-echo/", priority: 1, frequency: "weekly" as const },
    { path: "/the-last-echo/guides/", priority: 0.8, frequency: "weekly" as const },
    { path: "/the-last-echo/gallery.html", priority: 0.8, frequency: "monthly" as const },
    { path: "/the-last-echo/guides/how-idle-progression-works.html", priority: 0.7, frequency: "monthly" as const },
    { path: "/the-last-echo/guides/fair-gacha-design.html", priority: 0.7, frequency: "monthly" as const },
    { path: "/the-last-echo/guides/first-demo-guide.html", priority: 0.7, frequency: "monthly" as const },
    { path: "/the-last-echo/devlog/why-we-built-the-last-echo.html", priority: 0.7, frequency: "monthly" as const },
    { path: "/the-last-echo/about.html", priority: 0.6, frequency: "monthly" as const },
    { path: "/the-last-echo/support.html", priority: 0.4, frequency: "monthly" as const },
    { path: "/the-last-echo/privacy.html", priority: 0.3, frequency: "yearly" as const },
    { path: "/the-last-echo/terms.html", priority: 0.3, frequency: "yearly" as const },
  ];
  return pages.map((page) => ({
    url: `https://runs-it.com${page.path}`,
    lastModified: now,
    changeFrequency: page.frequency,
    priority: page.priority,
  }));
}
