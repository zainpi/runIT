export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

export const color = {
  bg: "#080b12",
  surface: "#10151e",
  line: "#243044",
  text: "#f4f6fc",
  muted: "#a5adbc",
  accent: "#a9b7ff",
  mint: "#6ee7cb",
  lime: "#c8f17f",
  limeInk: "#101a06",
};

export const font = {
  display: "Sora, sans-serif",
  body: "Inter, sans-serif",
};

// TikTok safe zone for text: clear of the top 8%, bottom 20% and right 15%.
export const safe = {
  top: Math.round(HEIGHT * 0.08) + 24,
  bottom: Math.round(HEIGHT * 0.8),
  left: 64,
  right: Math.round(WIDTH * 0.85),
};
export const safeWidth = safe.right - safe.left;

const s = (seconds: number) => Math.round(seconds * FPS);

// Scene boundaries in frames (21.4 s at 30 fps).
export const scenes = {
  hook: { from: 0, duration: s(3.4) },
  notes: { from: s(3.4), duration: s(2.4) },
  montage: { from: s(5.8), duration: s(2.6) },
  twist: { from: s(8.4), duration: s(1.2) },
  product: { from: s(9.6), duration: s(6.6) },
  payoff: { from: s(16.2), duration: s(2.2) },
  end: { from: s(18.4), duration: s(3.0) },
};
export const TOTAL = scenes.end.from + scenes.end.duration;

export const sec = s;

export const templates = ["Discord bot", "Roblox game", "Mobile game", "Mobile app", "Online store", "Browser game"];
