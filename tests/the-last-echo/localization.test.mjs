import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const PUBLIC = join(import.meta.dirname, "../../public");
const ORIGIN = "https://runs-it.com";
const LOCALES = ["es", "ko", "ja"];
const PAGES = {
  index: { en: "/the-last-echo/", local: (lc) => `/the-last-echo/${lc}/` },
  support: { en: "/the-last-echo/support.html", local: (lc) => `/the-last-echo/${lc}/support.html` },
  privacy: { en: "/the-last-echo/privacy.html", local: (lc) => `/the-last-echo/${lc}/privacy.html` },
  terms: { en: "/the-last-echo/terms.html", local: (lc) => `/the-last-echo/${lc}/terms.html` },
  redeem: { en: "/the-last-echo/redeem/", local: (lc) => `/the-last-echo/${lc}/redeem/` },
};

const fileFor = (url) => join(PUBLIC, url.endsWith("/") ? `${url}index.html` : url);
const read = (url) => readFileSync(fileFor(url), "utf8");
const urlFor = (page, lc) => (lc === "en" ? PAGES[page].en : PAGES[page].local(lc));

function hreflangs(html) {
  return Object.fromEntries(
    [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]),
  );
}

for (const page of Object.keys(PAGES)) {
  for (const lc of ["en", ...LOCALES]) {
    const url = urlFor(page, lc);

    test(`${url} declares its language, canonical URL and every alternate`, () => {
      const html = read(url);
      assert.match(html, new RegExp(`<html lang="${lc}"`, "i"));
      if (lc !== "en") assert.ok(html.includes(`<link rel="canonical" href="${ORIGIN}${url}">`));
      const alts = hreflangs(html);
      assert.deepEqual(Object.keys(alts).sort(), ["en", "es", "ja", "ko", "x-default"]);
      for (const alt of ["en", ...LOCALES]) assert.equal(alts[alt], `${ORIGIN}${urlFor(page, alt)}`);
      assert.equal(alts["x-default"], `${ORIGIN}${urlFor(page, "en")}`);
      assert.equal((html.match(/<details class="langs">/g) || []).length, 1);
      assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
    });

    test(`${url} links only to site pages that exist`, () => {
      const html = read(url);
      for (const [, href] of html.matchAll(/href="(\/the-last-echo\/[^"#?]*)/g)) {
        assert.ok(existsSync(fileFor(href)), `${url} links to missing ${href}`);
      }
    });
  }
}

for (const lc of LOCALES) {
  test(`${lc} redeem page keeps every server error and reward type translated`, () => {
    const en = read(PAGES.redeem.en);
    const local = read(PAGES.redeem.local(lc));
    const keys = (html, name) =>
      [...html.match(new RegExp(`const ${name}=\\{([\\s\\S]*?)\\n\\};`))[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    assert.deepEqual(keys(local, "REDEEM_ERRORS"), keys(en, "REDEEM_ERRORS"));
    assert.deepEqual(keys(local, "REWARD_META"), keys(en, "REWARD_META"));
    for (const english of ["That code has expired.", "Enter a code to redeem.", "Something went wrong redeeming"]) {
      assert.ok(!local.includes(english), `${lc} redeem still shows "${english}"`);
    }
    // The request logic itself must be unchanged.
    assert.ok(local.includes(`api("/rest/v1/rpc/redeem_code_by_number",{p_number:pid,p_code:code})`));
  });

  test(`${lc} terms publish the same gacha rates as the English terms`, () => {
    const rates = (html) =>
      [...html.split('id="gacha"')[1].split("</table>")[0].matchAll(/<td>([\d.,]+)\s?%<\/td>/g)].map((m) =>
        m[1].replace(",", "."),
      );
    const en = rates(read(PAGES.terms.en));
    assert.equal(en.length, 7);
    assert.deepEqual(rates(read(PAGES.terms.local(lc))), en);
  });
}
