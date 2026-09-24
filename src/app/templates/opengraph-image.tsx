import { templateFiles } from "@/components/runsos/apps";
import { ogContentType, ogSize, osPreview } from "@/components/runsos/og";
import { FIRST_TEMPLATE_CENTS, formatPrice } from "@/lib/templates/catalog";

export const alt = "runsIT AI templates — build your own app with beginner-friendly AI templates";
export const size = ogSize;
export const contentType = ogContentType;

export default function OgImage() {
  return osPreview({
    title: "Templates",
    tone: "#ffd23f",
    chips: templateFiles.map((template) => ({ label: template.title, tone: template.tone })),
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#5e594f" }}>~/runsIT/Templates · {templateFiles.length} items</div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>Build your own app with AI templates.</div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "#3d3a33" }}>From {formatPrice(FIRST_TEMPLATE_CENTS)} · No coding experience needed</div>
      </div>
    ),
  });
}
