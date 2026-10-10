import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const exports = {};
new Function(
  "exports",
  ts.transpileModule(fs.readFileSync("src/lib/artist/portfolio.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exports);
const {
  isStudioPortfolio,
  isPublishedPortfolio,
  artistPortfolioWorks,
  artistPortfolioPath,
} = exports;
const works = [
  { id: "legacy", artistId: "one" },
  { id: "new", artistId: "one", showcase: "artist", draftStatus: "published" },
  { id: "old-submission", artistId: "one", draftStatus: "published" },
  { id: "draft", artistId: "one", showcase: "artist", draftStatus: "draft" },
  { id: "review", artistId: "one", draftStatus: "pending_review" },
  { id: "rejected", artistId: "one", draftStatus: "rejected" },
  {
    id: "other",
    artistId: "two",
    showcase: "artist",
    draftStatus: "published",
  },
];
test("studio gallery retains original content without artist submissions", () => {
  assert.deepEqual(
    works
      .filter((p) => isStudioPortfolio(p) && isPublishedPortfolio(p))
      .map((p) => p.id),
    ["legacy"],
  );
});
test("artist portfolio is owner-scoped and excludes all unpublished work", () => {
  assert.deepEqual(
    artistPortfolioWorks(works, "one").map((p) => p.id),
    ["legacy", "new", "old-submission"],
  );
  assert.deepEqual(artistPortfolioWorks(works, "unknown"), []);
});
test("artist routes never point to the studio portfolio", () => {
  assert.equal(artistPortfolioPath("one"), "/artists/one/portfolio");
  assert.equal(
    artistPortfolioPath("one", "work"),
    "/artists/one/portfolio/work",
  );
  assert.equal(
    artistPortfolioPath("two", "work"),
    "/artists/two/portfolio/work",
  );
});
test("restored studio intro is not fed artist-directory content", () => {
  const page = fs.readFileSync("src/app/[locale]/portfolio/page.tsx", "utf8");
  assert.match(page, /<PortfolioIntro locale=\{locale\} \/>/);
  assert.doesNotMatch(
    page,
    /founderStatistics|ArtistsHubView|ProfileHeader|ProfileTabs/,
  );
});
