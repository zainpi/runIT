import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

const STATUS_BAR = 66;

export const PHONE = { left: 186, top: 330, screenWidth: 540, screenHeight: Math.round((540 * 2532) / 1170), bezel: 16 };

/** A minimal modern phone shell with a status bar; children fill a 1170x2532-ratio screen whose bottom is cropped. */
export const Phone = ({ children, scale = 1, y = 0 }: { children: ReactNode; scale?: number; y?: number }) => {
  const { left, top, screenWidth, screenHeight, bezel } = PHONE;
  return (
    <div style={{ position: "absolute", left, top, width: screenWidth + bezel * 2, height: screenHeight + bezel * 2, borderRadius: 86, background: "linear-gradient(145deg, #2b3242, #0c0f16 55%, #232a38)", padding: bezel, boxShadow: "0 60px 140px rgba(0,0,0,.6), 0 0 0 2px rgba(255,255,255,.08), inset 0 0 0 2px rgba(255,255,255,.06)", transform: `translateY(${y}px) scale(${scale})`, transformOrigin: "50% 60%" }}>
      <div style={{ position: "relative", width: screenWidth, height: screenHeight, borderRadius: 70, overflow: "hidden", background: "#0e141e" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: STATUS_BAR, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 44px 0 52px", background: "#0e141e", color: "#f4f6fc", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 22 }}>
          <span>9:41</span>
          <span style={{ letterSpacing: 3, fontSize: 18 }}>▮▮▮ ◔</span>
        </div>
        <div style={{ position: "absolute", top: 14, left: "50%", width: 136, height: 38, marginLeft: -68, borderRadius: 22, background: "#000" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: STATUS_BAR, bottom: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: screenWidth, height: screenHeight }}>
            <AbsoluteFill>{children}</AbsoluteFill>
          </div>
        </div>
      </div>
    </div>
  );
};
