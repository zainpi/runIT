import { desktopApps } from "@/components/runsos/apps";
import { ogContentType, ogSize, osPreview } from "@/components/runsos/og";

export const alt = "runsIT — Explore our products and build your own with AI templates";
export const size = ogSize;
export const contentType = ogContentType;

export default function OgImage() {
  return osPreview({
    title: "welcome.txt",
    tone: "#ff8a6b",
    chips: desktopApps.map((app) => ({ label: app.name, tone: app.tone })),
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", fontSize: 88, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Hi, we’re runsIT.</div>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 800, letterSpacing: -1.5, color: "#b8361a" }}>Explore our products. Build your own.</div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#3d3a33" }}>Apps, games and AI templates · No coding experience needed</div>
      </div>
    ),
  });
}
