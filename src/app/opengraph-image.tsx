import { ImageResponse } from "next/og";

export const alt = "runsIT — Explore our products and build your own with AI templates";
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
          position: "relative",
          overflow: "hidden",
          padding: "58px 64px 48px",
          background: "#07090f",
          color: "#f8fafc",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 540,
            height: 540,
            left: -170,
            top: -260,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(100, 112, 255, 0.3) 0%, rgba(100, 112, 255, 0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 620,
            height: 620,
            right: -230,
            bottom: -380,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(80, 222, 188, 0.18) 0%, rgba(80, 222, 188, 0) 72%)",
          }}
        />

        <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(145deg, #7c83ff 0%, #555ee8 100%)",
                  boxShadow: "0 12px 30px rgba(87, 96, 232, 0.35)",
                  fontSize: 27,
                  fontWeight: 700,
                }}
              >
                ›
              </div>
              <div style={{ display: "flex", alignItems: "baseline", fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>
                <span>runs</span>
                <span style={{ color: "#9ca3ff" }}>IT</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ display: "flex", padding: "10px 17px", borderRadius: 999, background: "rgba(124, 131, 255, 0.13)", border: "1px solid rgba(156, 163, 255, 0.38)", color: "#c6c9ff", fontSize: 18, fontWeight: 700 }}>
                Products
              </div>
              <div style={{ display: "flex", padding: "10px 17px", borderRadius: 999, background: "rgba(80, 222, 188, 0.1)", border: "1px solid rgba(80, 222, 188, 0.34)", color: "#8ce8d2", fontSize: 18, fontWeight: 700 }}>
                AI templates
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 23, marginTop: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 70, lineHeight: 1.02, letterSpacing: -3.2, fontWeight: 750, maxWidth: 970 }}>
              <span>Explore our products.</span>
              <span style={{ color: "#9ca3ff" }}>Build your own.</span>
            </div>
            <div style={{ display: "flex", fontSize: 27, lineHeight: 1.36, color: "#aeb6c7", maxWidth: 870 }}>
              Apps, games, and AI templates. No coding experience needed to get started.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(148, 163, 184, 0.16)",
              paddingTop: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 22, color: "#7f899b", fontSize: 18 }}>
              <span>Apps</span><span style={{ color: "#424a59" }}>•</span><span>Games</span><span style={{ color: "#424a59" }}>•</span><span>Build templates</span>
            </div>
            <div style={{ display: "flex", color: "#d5d8e2", fontSize: 21, fontWeight: 700, letterSpacing: 0.2 }}>
              runsit.ca
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
