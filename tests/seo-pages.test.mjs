import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/seo-pages.ts", "utf8");
const exports = {};
new Function(
  "exports",
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(exports);

const { SEO_ROUTE_DEFAULTS, createSeoMetadata, mergeSeoEntries, resolveSeoEntry } = exports;

test("SEO editor defaults cover every stable route in the sitemap and legal documents", () => {
  const sitemap = fs.readFileSync("src/app/sitemap.ts", "utf8");
  const staticMatch = sitemap.match(/const STATIC_PAGES = \[([\s\S]*?)\] as const/);
  assert.ok(staticMatch, "could not find the sitemap's static route list");
  const staticSegments = [...staticMatch[1].matchAll(/["']([^"']*)["']/g)].map((match) => match[1]);
  const configuredPaths = new Set(SEO_ROUTE_DEFAULTS.map((route) => route.path));
  for (const segment of staticSegments) {
    const path = segment ? `/${segment}` : "/";
    assert.ok(configuredPaths.has(path), `SEO editor is missing sitemap route ${path}`);
  }
  for (const doc of ["privacy", "terms", "licenses"]) {
    assert.ok(configuredPaths.has(`/legal/${doc}`), `SEO editor is missing /legal/${doc}`);
  }
  assert.equal(configuredPaths.has("/marketplace/cart"), false, "private/noindex cart should not be editable as an indexable SEO route");
});

test("legacy SEO values override route defaults while unknown stored paths are preserved", () => {
  const legacy = [
    { path: "/shop", title: { fa: "فروشگاه سفارشی", en: "Custom shop" }, description: { fa: "توضیح", en: "Description" } },
    { path: "/legacy/old", title: { fa: "قدیمی", en: "Legacy" }, description: { fa: "", en: "" } },
  ];
  const merged = mergeSeoEntries(legacy);
  assert.equal(merged.find((entry) => entry.path === "/shop").title.fa, "فروشگاه سفارشی");
  assert.equal(merged.find((entry) => entry.path === "/about").title.en, "About Rosie Atelier");
  assert.ok(merged.some((entry) => entry.path === "/legacy/old"));
  assert.equal(resolveSeoEntry([], "/patterns").title.fa, "پترن‌ها — آتلیه رزی");
});

test("managed SEO metadata follows locale, emits canonical, Open Graph and Twitter fields", () => {
  const entry = { path: "/shop", title: { fa: "فروشگاه ویرایش‌شده", en: "Edited shop" }, description: { fa: "شرح فارسی", en: "English description" } };
  const metadata = createSeoMetadata([entry], "/shop", "fa", "Fallback title");
  assert.deepEqual(metadata.title, { absolute: "فروشگاه ویرایش‌شده" });
  assert.equal(metadata.description, "شرح فارسی");
  assert.equal(metadata.alternates.canonical, "/fa/shop");
  assert.equal(metadata.openGraph.title, "فروشگاه ویرایش‌شده");
  assert.equal(metadata.twitter.title, "فروشگاه ویرایش‌شده");

  const root = createSeoMetadata([], "/", "fa", "Fallback", "Fallback description");
  assert.equal(root.alternates.canonical, "/fa");
  assert.equal(root.description, "پترن‌های اورجینال برای کاغذدیواری، طراحی پارچه، پرده و دکور — با طراحان مستقل.");
});

test("all managed static routes are wired to site metadata and dynamic public pages have route canonicals", () => {
  const wired = new Map([
    ["/", "src/app/[locale]/page.tsx"],
    ["/about", "src/app/[locale]/about/page.tsx"],
    ["/academy", "src/app/[locale]/academy/page.tsx"],
    ["/artists", "src/app/[locale]/artists/page.tsx"],
    ["/collections", "src/app/[locale]/collections/page.tsx"],
    ["/contact", "src/app/[locale]/contact/page.tsx"],
    ["/creators/join", "src/app/[locale]/creators/join/page.tsx"],
    ["/custom", "src/app/[locale]/custom/page.tsx"],
    ["/faq", "src/app/[locale]/faq/page.tsx"],
    ["/marketplace", "src/app/[locale]/marketplace/page.tsx"],
    ["/marketplace/subscriptions", "src/app/[locale]/marketplace/subscriptions/page.tsx"],
    ["/patterns", "src/app/[locale]/patterns/page.tsx"],
    ["/portfolio", "src/app/[locale]/portfolio/page.tsx"],
    ["/projects", "src/app/[locale]/projects/page.tsx"],
    ["/razieh", "src/app/[locale]/razieh/page.tsx"],
    ["/returns", "src/app/[locale]/returns/page.tsx"],
    ["/shop", "src/app/[locale]/shop/page.tsx"],
    ["/spaces", "src/app/[locale]/spaces/page.tsx"],
    ["/stories", "src/app/[locale]/stories/page.tsx"],
    ["/styles", "src/app/[locale]/styles/page.tsx"],
  ]);
  for (const [path, file] of wired) {
    const page = fs.readFileSync(file, "utf8");
    assert.ok(page.includes(`getEditableRouteMetadata("${path}"`) || page.includes(`getEditableRouteMetadata(\n    "${path}"`), `${file} does not use managed SEO for ${path}`);
  }
  const legal = fs.readFileSync("src/app/[locale]/legal/[doc]/page.tsx", "utf8");
  assert.match(legal, /getEditableRouteMetadata\(path, locale/);

  const layout = fs.readFileSync("src/app/[locale]/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /canonical: `\/\$\{locale\}`/, "layout must not assign the homepage canonical to every child route");
  const dynamicPages = [
    ["src/app/[locale]/patterns/[slug]/page.tsx", "/patterns/${slug}"],
    ["src/app/[locale]/shop/[slug]/page.tsx", "/shop/${slug}"],
    ["src/app/[locale]/portfolio/[slug]/page.tsx", "/portfolio/${slug}"],
    ["src/app/[locale]/academy/[slug]/page.tsx", "/academy/${slug}"],
    ["src/app/[locale]/collections/[slug]/page.tsx", "/collections/${slug}"],
    ["src/app/[locale]/styles/[slug]/page.tsx", "/styles/${slug}"],
    ["src/app/[locale]/spaces/[slug]/page.tsx", "/spaces/${slug}"],
    ["src/app/[locale]/stories/[slug]/page.tsx", "/stories/${slug}"],
    ["src/app/[locale]/marketplace/[slug]/page.tsx", "/marketplace/${slug}"],
  ];
  for (const [file, route] of dynamicPages) {
    assert.ok(fs.readFileSync(file, "utf8").includes(`canonical: \`/\$\{locale\}${route}\``), `${file} needs a route-specific canonical`);
  }
});
