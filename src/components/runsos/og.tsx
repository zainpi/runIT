import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

// Shared layout for runsOS link previews (Open Graph and Twitter cards).
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

const ink = "#1b1a17";

async function loadFonts() {
  try {
    const dir = join(process.cwd(), "src/assets/fonts");
    const [regular, heavy] = await Promise.all([readFile(join(dir, "Figtree-500.ttf")), readFile(join(dir, "Figtree-800.ttf"))]);
    return [
      { name: "Figtree", data: regular, weight: 500 as const, style: "normal" as const },
      { name: "Figtree", data: heavy, weight: 800 as const, style: "normal" as const },
    ];
  } catch {
    // Previews are prerendered at build time; if the files are unavailable, use the built-in font.
    return [];
  }
}

function Control() {
  return <div style={{ width: 20, height: 20, border: `3px solid ${ink}`, borderRadius: 5, background: "#fffdf7" }} />;
}

function Mark() {
  return (
    <svg width="46" height="46" viewBox="0 0 32 32">
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#fffdf7" />
      <path d="M1.5 8.5a7 7 0 0 1 7-7h15a7 7 0 0 1 7 7v3h-29z" fill="#ff5a36" />
      <path d="M1.5 11.25h29" stroke={ink} strokeWidth="2.5" />
      <path d="M8.5 16.5l5.5 4-5.5 4" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 24.5h6.5" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="none" stroke={ink} strokeWidth="2.5" />
    </svg>
  );
}

export async function osPreview({ title, tone, chips, children }: { title: string; tone: string; chips: { label: string; tone: string }[]; children: ReactNode }) {
  const fonts = await loadFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: "36px 56px 40px", background: "#ede4d3", color: ink, fontFamily: fonts.length ? "Figtree" : "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            <Mark />
            <span>runsIT</span>
          </div>
          <div style={{ display: "flex", padding: "8px 18px", border: `3px solid ${ink}`, borderRadius: 12, background: "#ffd23f", fontSize: 24, fontWeight: 800 }}>runsit.ca</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", border: `4px solid ${ink}`, borderRadius: 22, background: "#fffdf7", boxShadow: `12px 12px 0 ${ink}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 58, padding: "0 20px", background: tone, borderBottom: `4px solid ${ink}`, borderRadius: "18px 18px 0 0" }}>
            <Control /><Control /><Control />
            <div style={{ display: "flex", flex: 1, justifyContent: "center", marginRight: 90, fontSize: 26, fontWeight: 800 }}>{title}</div>
          </div>
          <div style={{ display: "flex", padding: "32px 44px 38px" }}>{children}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {chips.map((chip) => (
            <div key={chip.label} style={{ display: "flex", padding: "8px 16px", border: `3px solid ${ink}`, borderRadius: 12, background: chip.tone, fontSize: 22, fontWeight: 800 }}>{chip.label}</div>
          ))}
        </div>
      </div>
    ),
    { ...ogSize, fonts },
  );
}
