import assert from "node:assert/strict";
import test from "node:test";
import { createZip, crc32 } from "../../src/lib/templates/zip";

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("createZip writes readable stored entries and a matching central directory", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255]);
  const zip = createZip([{ name: "prompt.txt", data: "Hello “world”" }, { name: "icons/app-icon-v1.png", data: png }], new Date(2026, 9, 6, 12, 30, 10));
  const view = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  let central = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const found: Record<string, Uint8Array> = {};
  for (let index = 0; index < 2; index++) {
    assert.equal(view.getUint32(central, true), 0x02014b50);
    const nameLength = view.getUint16(central + 28, true), size = view.getUint32(central + 20, true), local = view.getUint32(central + 42, true);
    const name = decoder.decode(zip.slice(central + 46, central + 46 + nameLength));
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true);
    found[name] = zip.slice(start, start + size);
    assert.equal(crc32(found[name]), view.getUint32(central + 16, true));
    central += 46 + nameLength;
  }
  assert.equal(decoder.decode(found["prompt.txt"]), "Hello “world”");
  assert.deepEqual([...found["icons/app-icon-v1.png"]], [...png]);
});
