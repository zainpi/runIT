import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { color, font, safe, safeWidth } from "../brand";

export const outline = "0 3px 0 rgba(0,0,0,.55), 0 0 18px rgba(0,0,0,.55), 0 8px 30px rgba(0,0,0,.45)";

export const usePop = (delay = 0, damping = 13) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 180, mass: 0.7 } });
};

/** Big headline text inside the safe column, anchored at `top`. */
export const Headline = ({ children, top, size = 88, delay = 0, style }: { children: ReactNode; top: number; size?: number; delay?: number; style?: CSSProperties }) => {
  const pop = usePop(delay);
  return (
    <div style={{ position: "absolute", left: safe.left, width: safeWidth, top, fontFamily: font.display, fontWeight: 700, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.035em", color: color.text, textShadow: outline, opacity: pop, transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px) scale(${interpolate(pop, [0, 1], [0.92, 1])})`, transformOrigin: "left center", ...style }}>
      {children}
    </div>
  );
};

export const Hi = ({ children, tint = color.lime }: { children: ReactNode; tint?: string }) => <span style={{ color: tint }}>{children}</span>;

export type Word = { text: string; at: number };

/**
 * TikTok-style word-by-word captions: shows the current chunk of words and
 * highlights the one being spoken. `at` is in seconds from the sequence start.
 */
export const WordCaptions = ({ words, chunk = 3, top, until }: { words: Word[]; chunk?: number; top: number; until?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (words.length === 0 || t < words[0].at || (until !== undefined && t > until)) return null;
  let spoken = 0;
  while (spoken + 1 < words.length && words[spoken + 1].at <= t) spoken++;
  const start = Math.floor(spoken / chunk) * chunk;
  const group = words.slice(start, start + chunk);
  return (
    <div style={{ position: "absolute", left: safe.left, width: safeWidth, top, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 18px", fontFamily: font.display, fontWeight: 700, fontSize: 70, letterSpacing: "-0.02em", lineHeight: 1.12, textShadow: outline }}>
      {group.map((word, index) => {
        const i = start + index;
        const age = t - word.at;
        const shown = age >= 0;
        const pop = shown ? Math.min(1, age * 9) : 0;
        return (
          <span key={i} style={{ color: i === spoken ? color.lime : color.text, opacity: shown ? 1 : 0, transform: `scale(${0.8 + pop * 0.2})`, display: "inline-block", WebkitTextStroke: "2px rgba(0,0,0,.35)" }}>
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/** Step label for the product walkthrough: numbered lime badge plus text. */
export const StepLabel = ({ n, children, top }: { n?: number; children: ReactNode; top: number }) => {
  const pop = usePop(0, 14);
  return (
    <div style={{ position: "absolute", left: safe.left, width: safeWidth, top, display: "flex", alignItems: "center", gap: 22, opacity: pop, transform: `translateX(${interpolate(pop, [0, 1], [-50, 0])}px)` }}>
      {n ? (
        <div style={{ flex: "0 0 auto", width: 84, height: 84, borderRadius: 26, background: color.lime, color: color.limeInk, display: "grid", placeItems: "center", fontFamily: font.display, fontWeight: 700, fontSize: 50, boxShadow: "0 10px 30px rgba(200,241,127,.25)" }}>{n}</div>
      ) : null}
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 54, lineHeight: 1.05, letterSpacing: "-0.03em", color: color.text, textShadow: outline }}>{children}</div>
    </div>
  );
};
