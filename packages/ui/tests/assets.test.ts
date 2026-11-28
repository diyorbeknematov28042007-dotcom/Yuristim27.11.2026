import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const assetsRoot = path.resolve(import.meta.dirname, "../src/assets");
const webpRoot = path.join(assetsRoot, "stickers/webp");
const pngRoot = path.join(assetsRoot, "stickers/png");

describe("supplied Yuristim assets", () => {
  it("preserves the exact original logo source", () => {
    const source = readFileSync(path.join(assetsRoot, "brand/yuristim-logo-original.jpeg"));
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      "2a61ce2fb4e605528de95610092594673f825f45b7a89b8795ab068c3189a546",
    );
  });

  it("keeps every runtime sticker paired and below the 100 KB WebP target", () => {
    const webpNames = readdirSync(webpRoot).sort();
    const pngNames = readdirSync(pngRoot).sort();
    expect(webpNames).toHaveLength(11);
    expect(pngNames).toEqual(webpNames.map((name) => name.replace(/\.webp$/u, ".png")));
    for (const name of webpNames) {
      expect(statSync(path.join(webpRoot, name)).size, name).toBeLessThanOrEqual(100_000);
    }
  });
});
