import { ImageResponse } from "next/og";

export const alt = "runsIT — Explore our products and build your own with AI templates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#1b1a17";
const apps = [
  { name: "PulseDeals", tone: "#ffb27a" },
  { name: "The Last Echo", tone: "#a6db86" },
  { name: "Local Lore", tone: "#dcf76a" },
  { name: "Build Your Room", tone: "#7fd8ff" },
  { name: "Neutronium", tone: "#b8c6ff" },
];

function Square() {
  return <div style={{ width: 20, height: 20, border: `3px solid ${ink}`, borderRadius: 5, background: "#fffdf7" }} />;
}

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "44px 56px",
          background: "#ede4d3",
          backgroundImage: "radial-gradient(rgba(27, 26, 23, 0.14) 2px, transparent 2.5px)",
          backgroundSize: "30px 30px",
          color: ink,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", border: `4px solid ${ink}`, borderRadius: 22, background: "#fffdf7", boxShadow: `12px 12px 0 ${ink}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 58, padding: "0 20px", background: "#ff8a6b", borderBottom: `4px solid ${ink}`, borderRadius: "18px 18px 0 0" }}>
            <Square /><Square /><Square />
            <div style={{ display: "flex", flex: 1, justifyContent: "center", fontSize: 26, fontWeight: 700, marginRight: 90 }}>welcome.txt</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "34px 44px 40px", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 82, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Hi, we’re runsIT.</div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#b8361a", letterSpacing: -1 }}>Explore our products. Build your own.</div>
            <div style={{ display: "flex", fontSize: 26, color: "#3d3a33", marginTop: 4 }}>Apps, games and AI templates · No coding experience needed</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 38 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {apps.map((app) => (
              <div key={app.name} style={{ display: "flex", padding: "9px 16px", border: `3px solid ${ink}`, borderRadius: 12, background: app.tone, fontSize: 21, fontWeight: 700 }}>{app.name}</div>
            ))}
          </div>
          <div style={{ display: "flex", padding: "9px 18px", border: `3px solid ${ink}`, borderRadius: 12, background: "#ffd23f", fontSize: 22, fontWeight: 700 }}>runsit.ca</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
