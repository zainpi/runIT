import type { CSSProperties } from "react";
import { AbsoluteFill, Freeze, getStaticFiles, Img, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { color, font } from "../brand";

export const hasStaticFile = (path: string) => getStaticFiles().some((file) => file.name === path);

type ClipProps = {
  src: string;
  label: string;
  /** Source offset in frames. */
  startFrom?: number;
  playbackRate?: number;
  volume?: number;
  muted?: boolean;
  /** Hold this source frame instead of playing. */
  freezeAt?: number;
  blur?: number;
  dim?: number;
  style?: CSSProperties;
};

/** A generated clip, or a styled stand-in until the file exists in public/. */
export const Clip = ({ src, label, startFrom = 0, playbackRate = 1, volume = 1, muted, freezeAt, blur = 0, dim = 0, style }: ClipProps) => {
  const exists = hasStaticFile(src);
  const filter = blur ? `blur(${blur}px) saturate(1.1)` : undefined;
  const cover: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter, transform: blur ? "scale(1.08)" : undefined, ...style };
  const video = exists ? (
    <OffthreadVideo src={staticFile(src)} trimBefore={startFrom} playbackRate={playbackRate} volume={volume} muted={muted || freezeAt !== undefined} style={cover} />
  ) : (
    <Placeholder label={label} src={src} blur={blur} />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: color.bg }}>
      {freezeAt === undefined ? video : <Freeze frame={freezeAt}>{video}</Freeze>}
      {dim ? <AbsoluteFill style={{ backgroundColor: `rgba(8,11,18,${dim})` }} /> : null}
    </AbsoluteFill>
  );
};

/** A still (e.g. the hero keyframe) with the same placeholder fallback. */
export const Still = ({ src, label, blur = 0, dim = 0 }: { src: string; label: string; blur?: number; dim?: number }) => (
  <AbsoluteFill style={{ backgroundColor: color.bg }}>
    {hasStaticFile(src) ? (
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: blur ? `blur(${blur}px)` : undefined, transform: blur ? "scale(1.08)" : undefined }} />
    ) : (
      <Placeholder label={label} src={src} blur={blur} />
    )}
    {dim ? <AbsoluteFill style={{ backgroundColor: `rgba(8,11,18,${dim})` }} /> : null}
  </AbsoluteFill>
);

const Placeholder = ({ label, src, blur }: { label: string; src: string; blur: number }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 18) * 30;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(900px 700px at ${50 + drift / 10}% 38%, #2a2f4a 0%, #121828 45%, ${color.bg} 100%)`, filter: blur ? `blur(${blur / 2}px)` : undefined }}>
      <AbsoluteFill style={{ background: "radial-gradient(260px 300px at 50% 44%, rgba(244,214,180,.22), transparent 70%), radial-gradient(420px 280px at 30% 78%, rgba(255,196,120,.16), transparent 70%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1150, textAlign: "center", fontFamily: font.body, color: "rgba(244,246,252,.34)", fontSize: 26, letterSpacing: 4, textTransform: "uppercase" }}>
        placeholder · {label}
        <div style={{ fontSize: 20, letterSpacing: 1, textTransform: "none", marginTop: 8 }}>{src}</div>
      </div>
    </AbsoluteFill>
  );
};
