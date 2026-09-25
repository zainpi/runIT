import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon: the runsOS window mark on the desktop wallpaper colour.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ede4d3" }}>
        <svg width="136" height="136" viewBox="0 0 32 32">
          <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#fffdf7" />
          <path d="M1.5 8.5a7 7 0 0 1 7-7h15a7 7 0 0 1 7 7v3h-29z" fill="#ff5a36" />
          <path d="M1.5 11.25h29" stroke="#1b1a17" strokeWidth="2.5" />
          <path d="M8.5 16.5l5.5 4-5.5 4" fill="none" stroke="#1b1a17" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 24.5h6.5" stroke="#1b1a17" strokeWidth="3" strokeLinecap="round" />
          <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="none" stroke="#1b1a17" strokeWidth="2.5" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
