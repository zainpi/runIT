#!/usr/bin/env node
// the-last-echo-l10n.mjs: keeps the localized The Last Echo pages in sync.
//
// One list of locales drives, on every localized page (home, support, privacy,
// terms, redeem) in every language that exists on disk:
//   * the <link rel="alternate" hreflang> block (every language + x-default),
//   * the <!-- l10n:langs --> header language menu,
//   * the pixel-font fallback: monogram.ttf only has ASCII + Spanish accents, so a
//     second @font-face for the same family points at monogram-extended.ttf (CC0,
//     same designer, Latin-extended + Cyrillic) through unicode-range. Browsers use
//     it only for characters the base font lacks. CJK falls back to system fonts.
//
// Usage: node scripts/the-last-echo-l10n.mjs          (rewrite in place)
//        node scripts/the-last-echo-l10n.mjs --check  (exit 1 if anything is stale)
// Adding a language: add it to LOCALES, create its five pages, run this script,
// then add it to next.config.mjs, tests/the-last-echo and docs/the-last-echo-localization.md.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = join(import.meta.dirname, "../public");
const ORIGIN = "https://runs-it.com";

// dir: URL folder ("" = English root). hreflang/lang: BCP 47. word: "Language" in that language.
export const LOCALES = [
  { dir: "", hreflang: "en", label: "English", short: "EN", word: "Language" },
  { dir: "es", hreflang: "es", label: "Español", short: "ES", word: "Idioma" },
  { dir: "fr", hreflang: "fr", label: "Français", short: "FR", word: "Langue" },
  { dir: "de", hreflang: "de", label: "Deutsch", short: "DE", word: "Sprache" },
  { dir: "pt-br", hreflang: "pt-BR", label: "Português (Brasil)", short: "PT", word: "Idioma" },
  { dir: "ru", hreflang: "ru", label: "Русский", short: "RU", word: "Язык" },
  { dir: "ja", hreflang: "ja", label: "日本語", short: "JA", word: "言語" },
  { dir: "ko", hreflang: "ko", label: "한국어", short: "KO", word: "언어" },
  { dir: "zh-hans", hreflang: "zh-Hans", label: "简体中文", short: "中文", word: "语言" },
];

export const PAGES = ["", "support.html", "privacy.html", "terms.html", "redeem/"];

const EXT_FONT = "/the-last-echo/fonts/monogram-extended.ttf";
const EXT_RANGE = "U+00A0-024F, U+0300-036F, U+0400-04FF, U+1E00-1EFF, U+2010-2027";

export const urlFor = (loc, page) => `/the-last-echo/${loc.dir ? loc.dir + "/" : ""}${page}`;
const fileFor = (url) => join(PUBLIC, url.endsWith("/") ? `${url}index.html` : url);

function alternates(page, present) {
  const lines = present.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${ORIGIN}${urlFor(l, page)}">`);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}${urlFor(LOCALES[0], page)}">`);
  return lines.join("\n");
}

function menu(page, current, present) {
  const items = present
    .map((l) => {
      const cur = l === current ? ' aria-current="page"' : "";
      return `<li><a href="${urlFor(l, page)}" hreflang="${l.hreflang}" lang="${l.hreflang}"${cur}>${l.label}</a></li>`;
    })
    .join("");
  return (
    `<!-- l10n:langs --><details class="langs"><summary aria-label="${current.word}: ${current.label}">` +
    `🌐<span class="lc">${current.short}</span></summary><ul>${items}</ul></details>`
  );
}

function addFontFallback(html) {
  if (html.includes(EXT_FONT)) return html;
  // Every @font-face that loads monogram.ttf gets a same-family sibling for the
  // characters it lacks.
  return html.replace(/@font-face\s*\{[^}]*monogram\.ttf[^}]*\}/g, (rule) => {
    const fam = rule.match(/font-family\s*:\s*([^;}]+)/);
    if (!fam) return rule;
    return `${rule}@font-face{font-family:${fam[1].trim()};src:url('${EXT_FONT}') format('truetype');` +
      `unicode-range:${EXT_RANGE};font-display:swap}`;
  });
}

function main() {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const page of PAGES) {
    const present = LOCALES.filter((l) => existsSync(fileFor(urlFor(l, page))));
    for (const loc of present) {
      const path = fileFor(urlFor(loc, page));
      const before = readFileSync(path, "utf8");
      let html = before.replace(
        /(<link rel="alternate" hreflang="[^"]+" href="[^"]+">\s*)+/,
        () => alternates(page, present) + "\n",
      );
      html = html.replace(/<!-- l10n:langs --><details class="langs">[\s\S]*?<\/details>/, () => menu(page, loc, present));
      html = addFontFallback(html);
      if (html !== before) {
        stale++;
        if (check) console.log(`stale: ${urlFor(loc, page)}`);
        else writeFileSync(path, html);
      }
    }
  }
  console.log(`${check ? "stale" : "updated"} pages: ${stale}`);
  process.exit(check && stale ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
