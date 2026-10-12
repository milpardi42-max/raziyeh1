import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const projectDirectory = process.cwd();
const read = (file) => fs.readFileSync(path.join(projectDirectory, file), "utf8");

async function loadContentStore() {
  const source = fs.readFileSync(path.join(projectDirectory, "src/lib/data/store.ts"), "utf8");
  const previousCwd = process.cwd();
  const previousNodeEnv = process.env.NODE_ENV;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "artist-mutations-stage2-"));
  process.chdir(tempDirectory);
  process.env.NODE_ENV = "test";

  const seedContent = {
    artists: [],
    education: [],
    portfolios: [],
    portfolioCategories: [],
    siteMigrations: ["razieh-textile-portfolio-v1"],
  };
  const moduleExports = {};
  const baseRequire = createRequire(import.meta.url);
  const mockRequire = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "./seed") return { seedContent };
    if (specifier === "@/lib/media-storage") return { rewriteLegacyMediaUrls: (content) => content };
    if (specifier === "./razieh-textile-portfolio") {
      return { RAZIEH_TEXTILE_CATEGORY: {}, RAZIEH_TEXTILE_PORTFOLIO: {} };
    }
    return baseRequire(specifier);
  };
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("exports", "require", compiled)(moduleExports, mockRequire);

  return {
    store: moduleExports,
    cleanup() {
      process.chdir(previousCwd);
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    },
  };
}

test("atomic collection mutations preserve concurrent additions and return their own results", async () => {
  const { store, cleanup } = await loadContentStore();
  try {
    const results = await Promise.all([
      store.mutateCollection("artists", (artists) => {
        const artist = { id: "artist-one", slug: "one" };
        return { items: [...artists, artist], result: artist.id };
      }),
      store.mutateCollection("artists", (artists) => {
        const artist = { id: "artist-two", slug: "two" };
        return { items: [...artists, artist], result: artist.id };
      }),
    ]);

    const [content, etag] = await store.getContentWithEtag();
    assert.deepEqual(content.artists.map((artist) => artist.id).sort(), ["artist-one", "artist-two"]);
    assert.deepEqual(results.map((result) => result.result).sort(), ["artist-one", "artist-two"]);
    assert.ok(results.every((result) => typeof result.etag === "string" && result.etag.length > 0));
    assert.ok(results.some((result) => result.etag === etag), "the last mutation returns the persisted ETag");
  } finally {
    cleanup();
  }
});

test("a rejected collection mutation leaves the stored document unchanged", async () => {
  const { store, cleanup } = await loadContentStore();
  try {
    const [beforeContent, beforeEtag] = await store.getContentWithEtag();
    await assert.rejects(
      store.mutateCollection("artists", () => {
        throw new Error("mutation_rejected");
      }),
      /mutation_rejected/,
    );
    const [afterContent, afterEtag] = await store.getContentWithEtag();
    assert.equal(afterEtag, beforeEtag);
    assert.deepEqual(afterContent, beforeContent);
  } finally {
    cleanup();
  }
});

test("artist collection writers use atomic mutations rather than stale full-document writes", () => {
  const writerRoutes = [
    "src/app/api/artist/patterns/route.ts",
    "src/app/api/artist/drafts/route.ts",
    "src/app/api/artist/services/route.ts",
    "src/app/api/artist/profile/route.ts",
    "src/app/api/artist/inquiry/route.ts",
    "src/app/api/artist/subscription/route.ts",
  ];

  for (const route of writerRoutes) {
    const source = read(route);
    assert.match(source, /mutateCollection\(/, `${route} should mutate the latest collection`);
    assert.doesNotMatch(source, /\b(?:saveContent|updateCollection)\s*\(/, `${route} should not write a stale snapshot`);
  }

  const webinarSignal = read("src/app/api/webinar/[slug]/signal/route.ts");
  assert.match(webinarSignal, /saveContent\(\{ \.\.\.content, education \}, etag\)/,
    "the conditional webinar status writer remains outside this artist-route migration");
});
