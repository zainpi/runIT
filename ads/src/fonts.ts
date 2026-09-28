import { continueRender, delayRender, staticFile } from "remotion";

const faces = [
  ...[400, 500, 600, 700].map((weight) => ({ family: "Sora", file: `fonts/sora-${weight}.ttf`, weight })),
  ...[400, 500, 600, 700].map((weight) => ({ family: "Inter", file: `fonts/inter-${weight}.ttf`, weight })),
];

let loaded = false;

// Registers the brand fonts once, holding the first frame until they are ready.
export function loadFonts() {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("Loading Sora and Inter");
  Promise.all(
    faces.map(async ({ family, file, weight }) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format("truetype")`, { weight: String(weight) });
      document.fonts.add(await face.load());
    }),
  ).then(() => continueRender(handle), (error) => { console.error(error); continueRender(handle); });
}
