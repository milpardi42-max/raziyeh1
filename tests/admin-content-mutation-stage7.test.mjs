import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");

async function loadContentStore() {
  const projectDirectory = process.cwd();
  const source = read(path.join(projectDirectory, "src/lib/data/store.ts"));
  const previousCwd = process.cwd();
  const previousNodeEnv = process.env.NODE_ENV;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-content-mutation-"));
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

test("concurrent functional collection updates rebase on the latest content and return its ETag", async () => {
  const { store, cleanup } = await loadContentStore();
  try {
    const results = await Promise.all([
      store.updateCollection("artists", (items) => [...items, { id: "artist-a", slug: "a" }]),
      store.updateCollection("artists", (items) => [...items, { id: "artist-b", slug: "b" }]),
      store.updateCollection("education", (items) => [...items, { id: "lesson-a", slug: "lesson-a" }]),
    ]);

    const [content, etag] = await store.getContentWithEtag();
    assert.deepEqual(content.artists.map((artist) => artist.id).sort(), ["artist-a", "artist-b"]);
    assert.deepEqual(content.education.map((lesson) => lesson.id), ["lesson-a"]);
    assert.ok(results.includes(etag), "the final writer returns the ETag stored on the document");
  } finally {
    cleanup();
  }
});

test("admin artist and user mutations return the content version needed by AdminApp", () => {
  const artistsRoute = read("src/app/api/admin/artists/route.ts");
  const usersRoute = read("src/app/api/admin/users/route.ts");
  const artistsManager = read("src/components/admin/ArtistsManager.tsx");
  const signupManager = read("src/components/admin/ArtistsSignupManager.tsx");
  const usersManager = read("src/components/admin/UsersManager.tsx");
  const adminApp = read("src/components/admin/AdminApp.tsx");

  assert.match(artistsRoute, /mutateContent\(/);
  assert.match(artistsRoute, /withContentEtag\([\s\S]*?mutation\.etag/);
  assert.match(usersRoute, /mutateContent\(/);
  assert.match(usersRoute, /removedArtistIds/);
  assert.match(artistsManager, /onContentMutation\([\s\S]*?res\.headers\.get\("ETag"\)/);
  assert.match(signupManager, /onContentMutation\([\s\S]*?response\.headers\.get\("ETag"\)/);
  assert.match(usersManager, /onContentMutation\([\s\S]*?headers\.get\("ETag"\)/);
  assert.match(adminApp, /setContentEtag\(mutation\.etag\.replace/);
  assert.match(adminApp, /applyContentMutation/);
});
