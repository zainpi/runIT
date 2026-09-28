import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { color, font, safe, safeWidth, templates } from "../brand";
import { usePop } from "./Text";

export const Wordmark = ({ size }: { size: number }) => (
  <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: size, letterSpacing: "-0.09em", color: color.text, lineHeight: 1 }}>
    runs<span style={{ color: color.accent }}>IT</span><span style={{ color: color.mint }}>.</span>
  </div>
);

export const BrandBackdrop = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: color.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(760px 620px at ${22 + drift / 20}% 18%, rgba(169,183,255,.22), transparent 70%), radial-gradient(700px 600px at 88% ${78 + drift / 30}%, rgba(110,231,203,.16), transparent 70%)` }} />
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.035) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.035) 2px, transparent 2px)", backgroundSize: "90px 90px", maskImage: "radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)" }} />
    </AbsoluteFill>
  );
};

export const EndCard = () => {
  const mark = usePop(0);
  const line = usePop(6);
  const url = usePop(28);
  const bio = usePop(36);
  // Fixed-length list, so the hook order is stable between renders.
  const chipPops = templates.map((_, i) => usePop(12 + i * 2, 12)); // eslint-disable-line react-hooks/rules-of-hooks
  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <div style={{ position: "absolute", left: safe.left, width: safeWidth, top: 360 }}>
        <div style={{ opacity: mark, transform: `scale(${interpolate(mark, [0, 1], [0.8, 1])})`, transformOrigin: "left center" }}>
          <Wordmark size={210} />
        </div>
        <div style={{ marginTop: 34, opacity: line, fontFamily: font.display, fontWeight: 600, fontSize: 66, letterSpacing: "-0.03em", color: color.text, lineHeight: 1.12 }}>
          AI build templates
          <div style={{ color: color.lime }}>from $9.99</div>
        </div>
        <div style={{ marginTop: 20, opacity: line, fontFamily: font.body, fontSize: 40, color: color.muted }}>Your idea. A head start.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 60 }}>
          {templates.map((name, i) => (
            <div key={name} style={{ opacity: chipPops[i], transform: `translateY(${interpolate(chipPops[i], [0, 1], [24, 0])}px)`, padding: "18px 30px", borderRadius: 999, border: `2px solid ${color.line}`, background: color.surface, fontFamily: font.body, fontWeight: 600, fontSize: 36, color: color.text }}>
              {name}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 80, display: "inline-flex", alignItems: "center", gap: 18, opacity: url, transform: `scale(${interpolate(url, [0, 1], [0.85, 1])})`, transformOrigin: "left center", padding: "30px 48px", borderRadius: 30, background: color.lime, color: color.limeInk, fontFamily: font.display, fontWeight: 700, fontSize: 62, letterSpacing: "-0.03em", boxShadow: "0 18px 50px rgba(200,241,127,.25)" }}>
          runsit.ca/templates →
        </div>
        <div style={{ marginTop: 34, opacity: bio, fontFamily: font.body, fontWeight: 600, fontSize: 42, color: color.muted }}>link in bio ↑</div>
      </div>
    </AbsoluteFill>
  );
};
