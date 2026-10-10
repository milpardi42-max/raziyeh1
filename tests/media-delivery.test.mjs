import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

test("every bundled media reference in the seed data resolves to a non-empty local file", () => {
  // Seed content lives in the src/lib/data/seed/ module (split from the old single seed.ts).
  const seedSources = fs
    .readdirSync(path.join(root, "src/lib/data/seed"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => path.join("src/lib/data/seed", file));
  const sources = [...seedSources, "src/lib/razieh-profile.ts", "src/lib/artist/portfolio-data.ts"];
  const refs = new Set();
  for (const source of sources) {
    const text = fs.readFileSync(path.join(root, source), "utf8");
    for (const match of text.matchAll(/[\"'`]((?:\/images|\/videos)\/[^\"'`$]+)[\"'`]/g)) refs.add(match[1]);
  }
  assert.ok(refs.size > 0, "expected media references to be checked");
  const missing = [...refs].filter((url) => {
    const filename = path.join(root, "public", url.slice(1));
    return !fs.existsSync(filename) || fs.statSync(filename).size === 0;
  });
  assert.deepEqual(missing, [], `missing or empty bundled assets: ${missing.join(", ")}`);
});

test("new artist defaults point to bundled placeholder artwork", () => {
  const source = fs.readFileSync(path.join(root, "src/lib/data/users.ts"), "utf8");
  for (const url of source.matchAll(/\"(\/images\/placeholders\/[a-z-]+\.svg)\"/g)) {
    const file = path.join(root, "public", url[1].slice(1));
    assert.ok(fs.existsSync(file) && fs.statSync(file).size > 0, `missing placeholder ${url[1]}`);
  }
});

test("all bundled raster images can be decoded", async () => {
  const images = walk(path.join(root, "public", "images")).filter((file) => /\.(?:jpe?g|png|webp|avif)$/i.test(file));
  assert.ok(images.length > 0);
  const broken = [];
  for (const filename of images) {
    try {
      const info = await sharp(filename).metadata();
      if (!info.width || !info.height) broken.push(path.relative(root, filename));
    } catch {
      broken.push(path.relative(root, filename));
    }
  }
  assert.deepEqual(broken, [], `undecodable images: ${broken.join(", ")}`);
});

test("user-uploaded media uses first-party URLs and range-capable same-origin delivery", () => {
  for (const file of ["src/app/api/artist/upload/route.ts", "src/app/api/admin/academy/upload-video/route.ts"]) {
    assert.match(fs.readFileSync(path.join(root, file), "utf8"), /storePublicMedia/);
  }
  const delivery = fs.readFileSync(path.join(root, "src/app/api/media/[id]/route.ts"), "utf8");
  assert.match(delivery, /accept-ranges/);
  assert.match(delivery, /content-range/);
  assert.match(delivery, /206/);
});
