import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const exports = {};
const source = fs.readFileSync("src/lib/portfolio-categories.ts", "utf8");
new Function(
  "exports",
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
)(exports);
const { getPortfolioCategories, getUsedPortfolioCategories } = exports;

const category = (id, order) => ({
  id,
  slug: id,
  name: { fa: id, en: id },
  description: { fa: "", en: "" },
  image: "/category.jpg",
  featured: false,
  order,
});

test("portfolio category collection includes dedicated categories and legacy categories still in use", () => {
  const dedicated = category("textile", 2);
  const legacyUsed = category("legacy", 1);
  const legacyUnused = category("unused", 0);
  const site = {
    portfolioCategories: [dedicated],
    categories: [legacyUsed, legacyUnused],
    portfolios: [{ categoryId: "legacy" }, { categoryId: "textile" }],
  };
  assert.deepEqual(getPortfolioCategories(site).map(({ id }) => id), ["legacy", "textile"]);
});

test("public category filters exclude empty categories", () => {
  const site = {
    portfolioCategories: [category("used", 1), category("empty", 2)],
    categories: [],
    portfolios: [{ categoryId: "used" }],
  };
  assert.deepEqual(getUsedPortfolioCategories(site).map(({ id }) => id), ["used"]);
});

test("Razieh's curated textile portfolio and both generated visuals are wired into seed content", () => {
  // Seed content lives in the src/lib/data/seed/ module (split from the old single seed.ts).
  const seedDir = "src/lib/data/seed";
  const seed = fs
    .readdirSync(seedDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => fs.readFileSync(path.join(seedDir, file), "utf8"))
    .join("\n");
  const portfolio = fs.readFileSync("src/lib/data/razieh-textile-portfolio.ts", "utf8");
  assert.match(seed, /RAZIEH_TEXTILE_PORTFOLIO/);
  assert.match(seed, /portfolioCategories/);
  assert.match(portfolio, /artist-razieh-khairipour/);
  assert.match(portfolio, /ساخت پارچه/);
  assert.match(portfolio, /طراحی جلیقه/);
  for (const image of [
    "public/images/portfolios/razieh-textile-atelier.jpg",
    "public/images/portfolios/razieh-textile-process.jpg",
  ]) {
    assert.ok(fs.statSync(image).size > 0, image);
  }
});

test("portfolio categories can be managed from the portfolio admin tab", () => {
  const manager = fs.readFileSync("src/components/admin/PortfoliosManager.tsx", "utf8");
  assert.match(manager, /مدیریت دسته‌بندی‌های پورتفولیو/);
  assert.match(manager, /عنوان دسته‌بندی/);
  assert.match(manager, /LocalizedField label="توضیحات"/);
  assert.match(manager, /portfolioCategories:/);
});
