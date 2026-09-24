// Records real runsIT template screens on a phone-sized viewport for the ads.
//
// Runs the local Next.js dev server (started here if it is not already up on
// port 3102) with the same synthetic API responses the browser tests use, so no
// purchase, trial code, or AI provider is touched. Chrome's screencast captures
// every repaint at 3x density; frames are assembled into constant-30fps H.264.
//
//   cd ads && npm run footage          (writes public/footage/*.mp4 + marks.json)
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fixture from "../../tests/templates/fixtures/build-guide.json" with { type: "json" };
import type { AiSnapshot, AppPlan } from "../../src/lib/templates/ai-contract";
import { parseBuildGuide } from "../../src/lib/templates/guide-contract";
import { buildGuideHtml } from "../../src/lib/templates/guide-html";

const adsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(adsRoot, "..");
const outDir = join(adsRoot, "public", "footage");
const base = "http://127.0.0.1:3102";
const viewport = { width: 390, height: 844 };
const scale = 3;
const fps = 30;

const token = "ab".repeat(32);
const trialUrl = `${base}/templates/trial/#session_id=trial_${"1".repeat(64)}&access=${token}`;
const brief = { name: "BoulderMe", idea: "An app to find climbers at my gym with similar skills and plan a session together.", features: "iOS", style: "cozy, fun", budget: "" };
const plan: AppPlan = {
  overview: "BoulderMe helps climbers find their people. Meet someone at your level, at a gym you already love, and turn a solo session into a shared one.",
  features: [
    { part: "Onboarding", description: "Choose your climbing level, preferred gyms, and availability." },
    { part: "Climber profiles", description: "Show your bouldering grade, gym memberships, and whether you have a guest pass." },
    { part: "Find climbers", description: "Browse people at the same gym with a similar skill level." },
    { part: "Plan a session", description: "Invite someone to climb and agree on a gym and time." },
    { part: "Look & feel", description: "A cozy, playful design with friendly copy and approachable cards." },
  ],
  assumptions: ["Gym memberships and guest passes are self-reported."],
  questions: ["Should climbers connect one-to-one, or join small group sessions?"],
  questionChoices: [{ question: "Should climbers connect one-to-one, or join small group sessions?", options: ["One-to-one sessions", "Small group sessions"] }],
  technicalDetails: ["Keep gym, profile, and session records scoped to each account."],
};

// Injected into every page: hide dev-only UI and scrollbars, and draw a tap ripple.
const polish = () => {
  const style = document.createElement("style");
  style.textContent = `nextjs-portal{display:none!important}html{scrollbar-width:none}::-webkit-scrollbar{display:none}
  .ad-tap{position:fixed;z-index:2147483647;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;
  background:rgba(255,255,255,.38);box-shadow:0 0 0 2px rgba(255,255,255,.75),0 4px 18px rgba(0,0,0,.35);animation:ad-tap .55s ease-out forwards}
  @keyframes ad-tap{0%{transform:scale(.55);opacity:1}70%{opacity:.9}100%{transform:scale(1.35);opacity:0}}`;
  const attach = () => document.head.appendChild(style);
  if (document.head) attach(); else document.addEventListener("DOMContentLoaded", attach);
  addEventListener("pointerdown", (event) => {
    const dot = document.createElement("div");
    dot.className = "ad-tap";
    dot.style.left = `${event.clientX}px`;
    dot.style.top = `${event.clientY}px`;
    document.documentElement.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  }, true);
};

async function smoothScroll(page: Page, target: number | string, ms: number, offset = 24) {
  await page.evaluate(async ({ target, ms, offset }) => {
    const element = typeof target === "string" ? document.querySelector(target) : null;
    const to = element ? element.getBoundingClientRect().top + scrollY - offset : (target as number);
    const from = scrollY, start = performance.now();
    await new Promise<void>((done) => {
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        scrollTo(0, from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
  }, { target, ms, offset });
}

async function scrollToLocator(page: Page, locator: ReturnType<Page["locator"]>, ms: number, offset = 24) {
  const box = await locator.evaluate((node) => node.getBoundingClientRect().top + scrollY);
  await smoothScroll(page, box, ms, offset);
}

const ffmpeg = (args: string[]) => execFileSync(join(adsRoot, "node_modules", ".bin", "remotion"), ["ffmpeg", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });

type Marks = Record<string, number>;
type Helpers = { mark: (label: string) => void; wait: (ms: number) => Promise<void>; slow: number };
// Pages run in slow motion while full-resolution screenshots are taken, then the
// frames are retimed to real speed. CSS animations, scripted scrolls, typing and
// waits are all slowed by this factor, so motion stays smooth at 30 fps.
const slow = Number(process.env.AD_SLOWMO ?? 4);

async function record(context: BrowserContext, name: string, url: string, script: (page: Page, helpers: Helpers) => Promise<void>): Promise<{ duration: number; marks: Marks }> {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / slow });
  const work = await mkdtemp(join(tmpdir(), `ad-${name}-`));
  const frames: { t: number; file: string }[] = [];
  const writes: Promise<void>[] = [];
  const origin = performance.now();
  const now = () => (performance.now() - origin) / 1000 / slow;
  let capturing = true;
  const capture = (async () => {
    while (capturing) {
      const before = now();
      const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 93, optimizeForSpeed: true });
      const file = join(work, `${String(frames.length).padStart(6, "0")}.jpg`);
      frames.push({ t: (before + now()) / 2, file });
      writes.push(writeFile(file, Buffer.from(data, "base64")));
    }
  })();
  const marks: Marks = {};
  await script(page, {
    slow,
    mark: (label) => { marks[label] = Math.round(now() * 1000) / 1000; },
    wait: (ms) => page.waitForTimeout(ms * slow),
  });
  const duration = now();
  capturing = false;
  await capture;
  await Promise.all(writes);
  await page.close();
  if (!frames.length) throw new Error(`${name}: no frames captured`);
  // Constant frame rate: each output tick shows the latest frame captured by then.
  const list: string[] = [];
  let cursor = 0;
  for (let tick = 0; tick < Math.round(duration * fps); tick++) {
    while (cursor + 1 < frames.length && frames[cursor + 1].t <= tick / fps) cursor++;
    list.push(`file '${frames[cursor].file}'`, `duration ${(1 / fps).toFixed(6)}`);
  }
  list.push(`file '${frames[cursor].file}'`);
  const listFile = join(work, "frames.txt");
  await writeFile(listFile, list.join("\n"));
  const output = join(outDir, `${name}.mp4`);
  ffmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", `scale=${viewport.width * scale}:${viewport.height * scale}:flags=lanczos,format=yuv420p`, "-r", String(fps), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-movflags", "+faststart", output]);
  await rm(work, { recursive: true, force: true });
  console.log(`${name}.mp4  ${duration.toFixed(2)}s  ${frames.length} frames (${(frames.length / duration).toFixed(1)} effective fps)`, marks);
  return { duration: Math.round(duration * 1000) / 1000, marks };
}

async function ensureServer(): Promise<ChildProcess | null> {
  const up = async () => { try { return (await fetch(`${base}/templates/`)).ok; } catch { return false; } };
  if (await up()) return null;
  const child = spawn("npx", ["next", "dev", "--hostname", "127.0.0.1", "--port", "3102"], { cwd: repoRoot, env: { ...process.env, NEUTRONIUM_DIST_DIR: ".next-templates-test" }, stdio: "ignore", detached: true });
  for (let i = 0; i < 90; i++) { if (await up()) return child; await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error("The Next.js dev server did not start on port 3102.");
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const server = await ensureServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch(process.env.AD_CHROMIUM ? { executablePath: process.env.AD_CHROMIUM } : {});
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: true, hasTouch: true, colorScheme: "dark", locale: "en-CA" });
    // tsx/esbuild wraps named functions in __name(); functions sent to the page need it defined.
    await context.addInitScript({ content: "globalThis.__name = globalThis.__name || ((fn) => fn);" });
    await context.addInitScript(polish);
    await context.route("**/api/templates/config/**", (route) => route.fulfill({ json: { available: true, aiAvailable: true, testMode: false, currency: "cad" } }));
    await context.route("**/api/templates/trial/**", (route) => route.fulfill({ json: { templateId: "mobile-app", messageLimit: 3 } }));
    let trialState: AiSnapshot = { used: 0, remaining: 3, limit: 3, pending: false, projects: {}, overviewUsed: [], overviewConsent: false, canStartOverview: false };
    await context.route("**/api/templates/ai/**", (route) => route.fulfill({ json: { available: true, state: trialState } }));
    const results: Record<string, { duration: number; marks: Marks }> = {};

    results.store = await record(context, "store", `${base}/templates/`, async (page, { mark, wait, slow }) => {
      await wait(900);
      mark("scroll-templates");
      await scrollToLocator(page, page.getByRole("heading", { name: "What will you make?" }), 1100 * slow, 20);
      await wait(500);
      mark("tap-mobile-app");
      await page.getByRole("button", { name: "Add Mobile app", exact: true }).tap();
      await wait(900);
      mark("scroll-order");
      await scrollToLocator(page, page.getByRole("heading", { name: "Your order" }), 1000 * slow, 90);
      await wait(1300);
    });

    results.describe = await record(context, "describe", trialUrl, async (page, { mark, wait, slow }) => {
      await scrollToLocator(page, page.getByRole("heading", { name: "Your app plan" }), 10 * slow, 24);
      await wait(500);
      mark("type-name");
      await page.getByLabel("Project name").tap();
      await page.getByLabel("Project name").pressSequentially(brief.name, { delay: 75 * slow });
      await wait(250);
      mark("type-idea");
      await page.getByLabel("Project description").tap();
      await page.getByLabel("Project description").pressSequentially(brief.idea, { delay: 32 * slow });
      await wait(450);
      mark("tap-save");
      await page.getByRole("button", { name: "Save idea" }).tap();
      await wait(700);
    });

    trialState = {
      used: 0, remaining: 3, limit: 3, pending: false, overviewUsed: ["mobile-app"], initialBrief: brief, overviewConsent: true, canStartOverview: false,
      projects: { "mobile-app": { brief, plan, revision: 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, history: [{ role: "assistant", text: "I’ve shaped your brief into a first plan. Take a look at the features — tell me what you’d like to change." }] } },
    };
    results.plan = await record(context, "plan", trialUrl, async (page, { mark, wait, slow }) => {
      await wait(700);
      mark("scroll-plan");
      await scrollToLocator(page, page.getByRole("heading", { name: "Your app plan" }), 900 * slow, 24);
      await wait(900);
      mark("scroll-features");
      await scrollToLocator(page, page.getByText("What it will do", { exact: true }), 900 * slow, 24);
      await wait(400);
      const features = page.getByRole("list", { name: /Features for/ });
      mark("tap-feature");
      await features.getByRole("button", { name: /Find climbers/ }).tap();
      await wait(1300);
      mark("tap-feature-2");
      await features.getByRole("button", { name: /Plan a session/ }).tap();
      await wait(1300);
    });

    const guideHtml = buildGuideHtml({ id: "ad-guide", generatedAt: "2026-09-24T00:00:00Z", sourceRevision: 1, brief: fixture.brief, plan: fixture.plan, document: parseBuildGuide(fixture.document, fixture.plan) } as never, "Example build prompt");
    await context.route(`${base}/ad-guide.html`, (route) => route.fulfill({ contentType: "text/html", body: guideHtml }));
    results.guide = await record(context, "guide", `${base}/ad-guide.html`, async (page, { mark, wait, slow }) => {
      await wait(900);
      mark("scroll-steps");
      await scrollToLocator(page, page.locator("#steps"), 1100 * slow, 12);
      await wait(900);
      mark("scroll-prototype");
      await scrollToLocator(page, page.locator("#prototype"), 1100 * slow, 12);
      await wait(600);
      mark("tap-view");
      await page.getByRole("button", { name: "View Alex", exact: true }).tap();
      await wait(900);
      mark("tap-invite");
      await page.getByRole("button", { name: "Invite to climb", exact: true }).tap();
      await wait(800);
      mark("tap-accept");
      await page.getByRole("button", { name: "Accept invitation", exact: true }).tap();
      await wait(1300);
    });

    await writeFile(join(outDir, "marks.json"), JSON.stringify({ fps, width: viewport.width * scale, height: viewport.height * scale, scenes: results }, null, 2) + "\n");
  } finally {
    await browser?.close();
    if (server?.pid) { try { process.kill(-server.pid); } catch { /* already stopped */ } }
  }
}

await main();
