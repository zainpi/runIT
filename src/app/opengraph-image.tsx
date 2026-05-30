import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const runtime = "edge";
export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "radial-gradient(60% 60% at 50% 0%, #1b1b4b 0%, #05060a 60%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #6366f1, #4338ca)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            ›
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600 }}>
            <span>run</span>
            <span style={{ color: "#a5b4fc" }}>IT</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 26,
              color: "#a5b4fc",
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            AI Automation Agency
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            Stop Wasting Time on Repetitive Work
          </div>
          <div style={{ fontSize: 30, color: "#94a3b8", maxWidth: 900 }}>
            AI-powered automation that saves time, cuts costs, and helps your
            business scale.
          </div>
        </div>

        <div style={{ fontSize: 26, color: "#64748b" }}>{site.url}</div>
      </div>
    ),
    { ...size },
  );
}
