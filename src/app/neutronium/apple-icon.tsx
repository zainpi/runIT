import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Neutronium keeps its original mark (see ./icon.svg) rather than the runsOS company icon.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #6366f1, #4338ca)" }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M9 10l6 6-6 6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 22h7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
