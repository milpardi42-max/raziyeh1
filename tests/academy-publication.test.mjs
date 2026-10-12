import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/academy/publication.ts", "utf8");
const exports = {};
new Function(
  "exports",
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exports);
const { isPublishedEducation, publicEducationItems } = exports;

const records = [
  { id: "legacy" },
  { id: "published", draftStatus: "published" },
  { id: "draft", draftStatus: "draft" },
  { id: "pending", draftStatus: "pending_review" },
  { id: "rejected", draftStatus: "rejected" },
];

test("legacy and explicitly published academy records remain public", () => {
  assert.equal(isPublishedEducation(records[0]), true);
  assert.equal(isPublishedEducation(records[1]), true);
});

test("draft, pending-review, and rejected academy records are excluded", () => {
  for (const item of records.slice(2)) assert.equal(isPublishedEducation(item), false);
  assert.deepEqual(publicEducationItems(records).map((item) => item.id), ["legacy", "published"]);
});

test("public academy surfaces consistently apply the publication filter", () => {
  const checks = [
    ["src/app/[locale]/academy/page.tsx", /publicEducationItems\(site\.education\)/],
    ["src/app/[locale]/academy/[slug]/page.tsx", /isPublishedEducation/],
    ["src/app/[locale]/academy/[slug]/live/page.tsx", /isPublishedEducation/],
    ["src/app/[locale]/page.tsx", /publicEducationItems\(site\.education\)/],
    ["src/app/[locale]/search/page.tsx", /publicEducationItems\(site\.education\)/],
    ["src/app/sitemap.ts", /publicEducationItems\(site\.education\)/],
    ["src/app/api/search-index/route.ts", /publicEducationItems\(site\.education\)/],
    ["src/app/api/academy/enroll/route.ts", /isPublishedEducation/],
    ["src/app/api/academy/videos/[id]/route.ts", /isPublishedEducation/],
    ["src/app/api/webinar/[slug]/stream/route.ts", /isPublishedEducation/],
    ["src/app/api/webinar/[slug]/signal/route.ts", /isPublishedEducation/],
    ["src/components/layout/AnnouncementBarServer.tsx", /publicEducationItems\(site\.education\)/],
    ["src/lib/data/academy.ts", /publicEducationItems\(site\.education\)/],
    ["src/lib/data/enrich.ts", /publicEducationItems\(site\.education\)/],
    ["src/lib/data/founder-statistics.ts", /publicEducationItems\(site\.education\)/],
    ["src/lib/data/nav.ts", /publicEducationItems\(site\.education\)/],
  ];
  for (const [file, pattern] of checks) assert.match(fs.readFileSync(file, "utf8"), pattern, file);
});
