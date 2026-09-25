import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { color, font, safe } from "../brand";

export const IDEAS = ["climbing buddy app", "grandma's hot sauce store", "roblox obby w/ friends", "discord sneaker-drop bot", "boba shop idle game", "daily guess-my-city game"];
export const NOTES = { enter: 0, firstItem: 8, itemGap: 7, stamp: 56 };

const ios = { paper: "#fbfaf7", ink: "#1c1c1e", gray: "#8e8e93", rule: "#e5e5ea", yellow: "#e3a008" };

/** iOS Notes-style checklist that pops in one idea per template, then stamps "0 built". */
export const NotesCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 160 } });
  const stamp = spring({ frame: frame - NOTES.stamp, fps, config: { damping: 9, stiffness: 260, mass: 0.6 } });
  return (
    <div style={{ position: "absolute", left: safe.left, width: 790, top: 250, transform: `translateY(${interpolate(enter, [0, 1], [260, 0])}px) rotate(${interpolate(enter, [0, 1], [4, -1.2])}deg)`, opacity: enter, transformOrigin: "50% 100%" }}>
      <div style={{ background: ios.paper, borderRadius: 44, padding: "34px 50px 46px", boxShadow: "0 40px 100px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)", fontFamily: "-apple-system, 'SF Pro Text', Inter, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: ios.yellow, fontFamily: font.body, fontWeight: 500, fontSize: 32, marginBottom: 26 }}>
          <span>‹ Notes</span>
          <span style={{ letterSpacing: 6 }}>⋯</span>
        </div>
        <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 62, color: ios.ink, letterSpacing: "-0.02em" }}>app ideas 💡</div>
        <div style={{ fontFamily: font.body, fontSize: 25, color: ios.gray, margin: "8px 0 22px" }}>last edited 2 years ago</div>
        {IDEAS.map((idea, index) => {
          const at = NOTES.firstItem + index * NOTES.itemGap;
          const pop = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 240, mass: 0.6 } });
          const tick = spring({ frame: frame - at - 3, fps, config: { damping: 14, stiffness: 300 } });
          return (
            <div key={idea} style={{ display: "flex", alignItems: "center", gap: 24, padding: "19px 0", borderBottom: index < IDEAS.length - 1 ? `2px solid ${ios.rule}` : "none", opacity: pop, transform: `translateX(${interpolate(pop, [0, 1], [-30, 0])}px) scale(${interpolate(pop, [0, 1], [0.94, 1])})` }}>
              <div style={{ flex: "0 0 auto", width: 46, height: 46, borderRadius: "50%", border: `3px solid ${tick > 0.5 ? ios.yellow : "#c7c7cc"}`, background: tick > 0.5 ? ios.yellow : "transparent", display: "grid", placeItems: "center", color: "white", fontSize: 30, fontWeight: 700, transform: `scale(${0.7 + tick * 0.3})` }}>
                {tick > 0.5 ? "✓" : ""}
              </div>
              <div style={{ fontFamily: font.body, fontWeight: 500, fontSize: 40, color: ios.ink, letterSpacing: "-0.01em" }}>{idea}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", right: -16, bottom: -128, opacity: frame >= NOTES.stamp ? 1 : 0, transform: `rotate(-11deg) scale(${interpolate(stamp, [0, 1], [2.4, 1])})`, padding: "16px 34px", border: "8px solid #ff4d5e", borderRadius: 22, color: "#ff4d5e", background: "rgba(255,255,255,.92)", fontFamily: font.display, fontWeight: 700, fontSize: 84, letterSpacing: "-0.02em", boxShadow: "0 18px 40px rgba(0,0,0,.35)" }}>
        0 built
      </div>
    </div>
  );
};
