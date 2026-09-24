import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { color, font, safe, safeWidth, scenes, sec, TOTAL } from "./brand";
import { Clip, hasStaticFile, Still } from "./components/Clip";
import { BrandBackdrop, EndCard } from "./components/EndCard";
import { NOTES, NotesCard, IDEAS } from "./components/NotesCard";
import { Phone } from "./components/Phone";
import { Headline, Hi, StepLabel, WordCaptions } from "./components/Text";
import { loadFonts } from "./fonts";
import { HOOK_TRIM, HOOK_WORDS, MONTAGE_CUTS, PAYOFF_RATE, PAYOFF_TRIM, PLANNING, PRODUCT, STEPS } from "./timing";

export type NotesAppIdeasProps = { music: boolean };

loadFonts();

const clip = (name: string) => `campaigns/notes-app-ideas/clips/${name}.mp4`;
const HERO = "campaigns/notes-app-ideas/keyframes/hero.png";
const MUSIC = "music/idea-pulse.wav";
const sfx = { pop: "sfx/click_003.ogg", tap: "sfx/click2.ogg", stamp: "sfx/impactSoft_medium_001.ogg", whoosh: "sfx/card-slide-1.ogg" };

const Sfx = ({ at, src, volume = 0.6 }: { at: number; src: string; volume?: number }) => (
  <Sequence from={at} durationInFrames={sec(1.2)} layout="none">
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

/** Punch-in zoom used on hard cuts. */
const usePunch = (amount = 0.06) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return 1 + amount * (1 - spring({ frame, fps, config: { damping: 18, stiffness: 120 } }));
};

const Hook = () => {
  const scale = usePunch(0.08);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Clip src={clip("hook")} label="hook clip" startFrom={Math.round(HOOK_TRIM * 30)} volume={1} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,11,18,.62) 0%, rgba(8,11,18,0) 34%, rgba(8,11,18,0) 62%, rgba(8,11,18,.45) 80%)" }} />
      <Headline top={safe.top + 40} size={96}>my notes app is<br />an <Hi>app-idea graveyard</Hi></Headline>
      <WordCaptions words={HOOK_WORDS} top={1290} />
    </AbsoluteFill>
  );
};

const Notes = () => (
  <AbsoluteFill>
    {hasStaticFile(clip("hook"))
      ? <Clip src={clip("hook")} label="hook freeze" freezeAt={Math.round(HOOK_TRIM * 30) + scenes.hook.duration} blur={28} dim={0.35} />
      : <Still src={HERO} label="hero freeze" blur={28} dim={0.35} />}
    <NotesCard />
  </AbsoluteFill>
);

const Montage = () => {
  const cut = Math.round(scenes.montage.duration / MONTAGE_CUTS.length);
  return (
    <AbsoluteFill>
      {MONTAGE_CUTS.map((start, i) => (
        <Sequence key={start} from={i * cut} durationInFrames={i === MONTAGE_CUTS.length - 1 ? scenes.montage.duration - i * cut : cut}>
          <MontageShot start={start} index={i} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,11,18,.55) 0%, rgba(8,11,18,0) 30%)" }} />
      <Headline top={safe.top + 60} size={92}>everyone's<br />sitting on <Hi>one.</Hi></Headline>
    </AbsoluteFill>
  );
};

const MontageShot = ({ start, index }: { start: number; index: number }) => {
  const scale = usePunch(0.07);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <Clip src={clip("montage")} label={`montage shot ${index + 1}`} startFrom={Math.round(start * 30)} volume={0.55} />
    </AbsoluteFill>
  );
};

const Twist = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = ["what", "if", "it", "came", "with", "the", "build", "plan?"];
  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <div style={{ position: "absolute", left: safe.left, width: safeWidth, top: 560, display: "flex", flexWrap: "wrap", gap: "0 26px", fontFamily: font.display, fontWeight: 700, fontSize: 118, lineHeight: 1.02, letterSpacing: "-0.045em" }}>
        {words.map((word, i) => {
          const pop = spring({ frame: frame - i * 2.5, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
          return (
            <span key={i} style={{ display: "inline-block", color: i >= 6 ? color.lime : color.text, opacity: pop, transform: `translateY(${interpolate(pop, [0, 1], [70, 0])}px) rotate(${interpolate(pop, [0, 1], [i % 2 ? 6 : -6, 0])}deg)` }}>
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Planning = () => {
  const frame = useCurrentFrame();
  const dots = ".".repeat(1 + (Math.floor(frame / 4) % 3));
  return (
    <AbsoluteFill style={{ background: "#0e141e", alignItems: "center", justifyContent: "center", fontFamily: font.body, color: color.text }}>
      <div style={{ fontSize: 70, color: color.lime, transform: `rotate(${frame * 9}deg)` }}>✦</div>
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 34, marginTop: 20 }}>Planning your app{dots}</div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 420, height: 64, marginTop: 20, borderRadius: 18, background: `linear-gradient(90deg, #172030 ${(frame * 8 + i * 30) % 140 - 40}%, #24304a ${(frame * 8 + i * 30) % 140 - 10}%, #172030 ${(frame * 8 + i * 30) % 140 + 20}%)` }} />
      ))}
    </AbsoluteFill>
  );
};

const Product = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <Phone y={interpolate(enter, [0, 1], [900, 0])}>
        {PRODUCT.map((seg) => (
          <Sequence key={`${seg.name}${seg.from}`} from={seg.from} durationInFrames={seg.frames}>
            <Clip src={seg.src} label={`${seg.name} footage`} startFrom={seg.trimBefore} playbackRate={seg.playbackRate} muted />
          </Sequence>
        ))}
        <Sequence from={PLANNING.from} durationInFrames={PLANNING.frames}>
          <Planning />
        </Sequence>
      </Phone>
      {STEPS.map((s, i) => (
        <Sequence key={s.text} from={s.from} durationInFrames={(STEPS[i + 1]?.from ?? scenes.product.duration) - s.from}>
          <StepLabel n={s.n || undefined} top={safe.top + 20}>{s.text}</StepLabel>
        </Sequence>
      ))}
      {PRODUCT.flatMap((seg) => seg.taps.map((t) => <Sfx key={`${seg.name}${seg.from}-${t}`} at={seg.from + t} src={sfx.tap} volume={0.7} />))}
      {STEPS.map((s) => <Sfx key={`w${s.from}`} at={s.from} src={sfx.whoosh} volume={0.25} />)}
    </AbsoluteFill>
  );
};

const Payoff = () => {
  const scale = usePunch(0.05);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Clip src={clip("payoff")} label="payoff clip" startFrom={Math.round(PAYOFF_TRIM * 30)} playbackRate={PAYOFF_RATE} volume={0.6} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,11,18,.6) 0%, rgba(8,11,18,0) 36%)" }} />
      <Sequence durationInFrames={sec(1.0)} layout="none">
        <Headline top={safe.top + 40} size={84}>paste it into<br />your AI coder…</Headline>
      </Sequence>
      <Sequence from={sec(1.0)} layout="none">
        <Headline top={safe.top + 40} size={84}>…and <Hi>actually<br />build it.</Hi></Headline>
      </Sequence>
    </AbsoluteFill>
  );
};

export const NotesAppIdeas = ({ music }: NotesAppIdeasProps) => {
  const frame = useCurrentFrame();
  // Keep the bed low under dialogue, lift it for the product beat and end card.
  const bed = interpolate(
    frame,
    [0, scenes.notes.from - 6, scenes.notes.from, scenes.product.from - 4, scenes.product.from, scenes.payoff.from - 4, scenes.payoff.from, scenes.end.from - 4, scenes.end.from, TOTAL - 20, TOTAL],
    [0.08, 0.08, 0.3, 0.3, 0.6, 0.6, 0.3, 0.3, 0.55, 0.55, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill style={{ backgroundColor: color.bg, fontFamily: font.body }}>
      <Sequence {...scenes.hook} name="1 hook"><Hook /></Sequence>
      <Sequence {...scenes.notes} name="2 notes"><Notes /></Sequence>
      <Sequence {...scenes.montage} name="3 montage"><Montage /></Sequence>
      <Sequence {...scenes.twist} name="4 twist"><Twist /></Sequence>
      <Sequence {...scenes.product} name="5 product"><Product /></Sequence>
      <Sequence {...scenes.payoff} name="6 payoff"><Payoff /></Sequence>
      <Sequence {...scenes.end} name="7 end card"><EndCard /></Sequence>

      <Sfx at={scenes.notes.from} src={sfx.whoosh} volume={0.5} />
      {IDEAS.map((_, i) => <Sfx key={i} at={scenes.notes.from + NOTES.firstItem + i * NOTES.itemGap + 3} src={sfx.pop} volume={0.55} />)}
      <Sfx at={scenes.notes.from + NOTES.stamp} src={sfx.stamp} volume={0.9} />
      <Sfx at={scenes.twist.from} src={sfx.whoosh} volume={0.45} />
      <Sfx at={scenes.end.from} src={sfx.stamp} volume={0.5} />
      {music && hasStaticFile(MUSIC) ? <Audio src={staticFile(MUSIC)} volume={bed} /> : null}
    </AbsoluteFill>
  );
};
