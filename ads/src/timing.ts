import footage from "../public/footage/marks.json";
import voiceover from "../public/voiceover/vo.json";
import { FPS, scenes, sec } from "./brand";
import type { Word } from "./components/Text";

// Voiceover lines (scripts/make-voiceover.py): each has its start in the edit and word timings.
export const VOICEOVER = voiceover.lines;
const hookLine = VOICEOVER.find((line) => line.id === "hook");

// Hook: the source offset into clips/hook.mp4, and captions timed to her voiceover line.
export const HOOK_TRIM = 0;
export const HOOK_WORDS: Word[] = (hookLine?.words ?? []).map((word) => ({ text: word.text, at: hookLine!.at + word.at }));

// Montage: three hard cuts, one from each shot of clips/montage.mp4 (source seconds).
export const MONTAGE_CUTS = [1.1, 2.5, 4.05]; // his grin, the gamer laughing, the climber typing an idea

// Payoff: the take types until ~3.3 s, covers her mouth, then throws her hands up at ~4.8 s.
// Start mid-typing and play slightly fast so the celebration lands inside 2.2 s.
export const PAYOFF_TRIM = 1.9;
export const PAYOFF_RATE = 1.4;

type SceneName = keyof typeof footage.scenes;
type Segment = { name: SceneName; src: string; from: number; frames: number; trimBefore: number; playbackRate: number; taps: number[] };

const mark = (scene: SceneName, label: string, fallback: number) => (footage.scenes[scene].marks as Record<string, number>)[label] ?? fallback;

/** Fit a source window [start, end] (seconds) of a recording into `frames`, and map its tap marks. */
function segment(name: SceneName, from: number, frames: number, start: number, end: number, tapLabels: string[]): Segment {
  const playbackRate = (end - start) / (frames / FPS);
  const taps = tapLabels
    .map((label) => mark(name, label, -1))
    .filter((t) => t >= start && t <= end)
    .map((t) => Math.round(((t - start) / playbackRate) * FPS));
  return { name, src: `footage/${name}.mp4`, from, frames, trimBefore: Math.round(start * FPS), playbackRate, taps };
}

// Product walkthrough (frames relative to scenes.product.from); 198 frames in total.
// Each recording is trimmed around its tap marks and sped up to fit its slot.
const m = (scene: SceneName, label: string, fallback: number) => mark(scene, label, fallback);
export const PLANNING = { from: sec(2.9), frames: sec(0.5) };
const PLAN_AT = PLANNING.from + PLANNING.frames;
const GUIDE_AT = PLAN_AT + sec(1.4);
const PROTOTYPE_AT = GUIDE_AT + sec(0.6);
export const PRODUCT: Segment[] = [
  segment("store", 0, sec(1.4), m("store", "scroll-templates", 0.9) + 0.2, m("store", "scroll-order", 3.4) + 0.3, ["tap-mobile-app"]),
  segment("describe", sec(1.4), sec(1.5), m("describe", "type-name", 0.5) - 0.05, m("describe", "tap-save", 4.9) + 0.35, ["tap-save"]),
  segment("plan", PLAN_AT, sec(1.4), m("plan", "scroll-features", 2.5) - 0.1, m("plan", "tap-feature-2", 5.1) + 0.55, ["tap-feature", "tap-feature-2"]),
  segment("guide", GUIDE_AT, sec(0.6), m("guide", "scroll-steps", 0.9), m("guide", "scroll-prototype", 2.9) + 0.5, []),
  segment("guide", PROTOTYPE_AT, scenes.product.duration - PROTOTYPE_AT, m("guide", "tap-invite", 5.5) - 0.35, m("guide", "tap-accept", 6.4) + 0.45, ["tap-invite", "tap-accept"]),
];

export const STEPS = [
  { n: 1, text: "pick a template", from: 0 },
  { n: 2, text: "describe your idea", from: sec(1.4) },
  { n: 0, text: "AI is planning…", from: PLANNING.from },
  { n: 3, text: "AI turns it into a real plan", from: PLAN_AT },
  { n: 4, text: "step-by-step guide + clickable prototype", from: GUIDE_AT },
];
