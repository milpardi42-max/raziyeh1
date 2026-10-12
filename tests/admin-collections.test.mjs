import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function loadModule(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", compiled)(exports);
  return exports;
}

const { getCategoryUsageCounts, hasCategoryReferences } = loadModule("src/lib/category-references.ts");
const { getCollectionReferenceIssues } = loadModule("src/lib/collection-references.ts");

test("category deletion dependencies cover patterns, products, academy, and legacy portfolios", () => {
  const content = {
    patterns: [{ categoryId: "used" }, { categoryId: "other" }],
    products: [{ categoryId: "used" }],
    education: [{ categoryId: "used" }, { categoryId: "used" }],
    portfolios: [{ categoryId: "used" }],
  };
  const usage = getCategoryUsageCounts(content, "used");
  assert.deepEqual(usage, { patterns: 1, products: 1, education: 2, portfolios: 1 });
  assert.equal(hasCategoryReferences(usage), true);
  assert.equal(hasCategoryReferences(getCategoryUsageCounts(content, "unused")), false);
});

test("collection references report missing patterns and products without changing valid links", () => {
  const collection = { patternIds: ["pattern-a", "missing-pattern"], productIds: ["product-a", "missing-product"] };
  const issues = getCollectionReferenceIssues(
    collection,
    [{ id: "pattern-a" }],
    [{ id: "product-a" }],
  );
  assert.deepEqual(issues, {
    missingPatternIds: ["missing-pattern"],
    missingProductIds: ["missing-product"],
  });
  assert.deepEqual(
    getCollectionReferenceIssues(collection, [{ id: "pattern-a" }, { id: "missing-pattern" }], [{ id: "product-a" }, { id: "missing-product" }]),
    { missingPatternIds: [], missingProductIds: [] },
  );
});

test("collection CRUD is reachable in admin and edits every public collection field and link", () => {
  const admin = fs.readFileSync("src/components/admin/AdminApp.tsx", "utf8");
  const manager = fs.readFileSync("src/components/admin/CollectionsManager.tsx", "utf8");
  assert.match(admin, /id: "collections", label: "مجموعه‌ها"/);
  assert.match(admin, /section === "collections" && <CollectionsManager/);
  for (const field of ["title", "slug", "description", "cover", "patternIds", "productIds"]) {
    assert.match(manager, new RegExp(`\\b${field}\\b`), `missing editable collection field ${field}`);
  }
  assert.match(manager, /getCollectionReferenceIssues/);
  assert.match(manager, /این اسلاگ قبلاً/);
  assert.match(manager, /update\(\{\s*collections:/);
  assert.match(manager, /حذف شود\؟ پترن‌ها و محصولات آن حذف نمی‌شوند/);
});

test("all shared-category deletion controls reject categories that still have references", () => {
  const admin = fs.readFileSync("src/components/admin/AdminApp.tsx", "utf8");
  const home = fs.readFileSync("src/components/admin/HomeSectionsManager.tsx", "utf8");
  for (const [name, source] of [["catalog categories", admin], ["home styles", home]]) {
    assert.match(source, /getCategoryUsageCounts/ , `${name} does not count dependencies`);
    assert.match(source, /hasCategoryReferences\(usage\)/, `${name} does not block deletion`);
    assert.match(source, /محتوای آکادمی/ , `${name} does not include academy content`);
    assert.match(source, /پورتفولیو/ , `${name} does not include portfolio references`);
  }
});
