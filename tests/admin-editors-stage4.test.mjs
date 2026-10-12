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

const { getPatternReferenceCounts, getProductReferenceCounts, hasCatalogReferences } = loadModule("src/lib/catalog-references.ts");
const { hasUniqueIds, validateArtistServices } = loadModule("src/lib/admin-editor-validation.ts");

test("editor validation allows incomplete inactive services but protects active data and unique IDs", () => {
  const activeService = {
    id: "service-a",
    title: { fa: "مشاوره", en: "Consulting" },
    description: { fa: "توضیح", en: "Description" },
    price: { fa: 100, en: 10 },
    active: true,
  };
  const incompleteInactiveService = {
    ...activeService,
    id: "service-draft",
    title: { fa: "", en: "" },
    description: { fa: "", en: "" },
    price: { fa: 0, en: 0 },
    active: false,
  };

  assert.equal(hasUniqueIds([{ id: "a" }, { id: "b" }]), true);
  assert.equal(hasUniqueIds([{ id: "a" }, { id: " a " }]), false);
  assert.equal(hasUniqueIds([{ id: "" }]), false);
  assert.equal(validateArtistServices([activeService, incompleteInactiveService]), null);
  assert.equal(validateArtistServices([{ ...activeService, title: { fa: "", en: "" } }]), "incomplete-active-service");
  assert.equal(validateArtistServices([activeService, { ...activeService }]), "duplicate-id");
});

test("pattern and product deletion guards count every site-content relationship", () => {
  const content = {
    products: [{ patternId: "pattern-a" }, { patternId: "pattern-a" }],
    collections: [{ patternIds: ["pattern-a"], productIds: ["product-a"] }],
    portfolios: [{ patternIds: ["pattern-a"], productIds: ["product-a"] }],
    education: [{ patternIds: ["pattern-a"], productIds: ["product-a"] }, { patternIds: [], productIds: [] }],
  };
  const patternRefs = getPatternReferenceCounts(content, "pattern-a");
  assert.deepEqual(patternRefs, { products: 2, portfolios: 1, education: 1, collections: 1 });
  assert.equal(hasCatalogReferences(patternRefs), true);
  assert.deepEqual(getPatternReferenceCounts(content, "unused"), { products: 0, portfolios: 0, education: 0, collections: 0 });

  const productRefs = getProductReferenceCounts(content, "product-a");
  assert.deepEqual(productRefs, { portfolios: 1, education: 1, collections: 1 });
  assert.equal(hasCatalogReferences(productRefs), true);
  assert.equal(hasCatalogReferences(getProductReferenceCounts(content, "unused")), false);
});

test("pattern and product managers expose full editors while preserving first-variant product creation", () => {
  const patterns = fs.readFileSync("src/components/admin/PatternsManager.tsx", "utf8");
  const patternEditor = fs.readFileSync("src/components/admin/PatternEditor.tsx", "utf8");
  const products = fs.readFileSync("src/components/admin/ProductsManager.tsx", "utf8");
  const productEditor = fs.readFileSync("src/components/admin/ProductEditor.tsx", "utf8");
  assert.match(patterns, /<PatternEditor/);
  assert.match(patterns, /پترن جدید/);
  assert.match(patterns, /getPatternReferenceCounts/);
  for (const field of ["title", "description", "sku", "slug", "categoryId", "artistId", "price", "gallery", "palette", "tags", "specs", "colorways", "spaceIds"]) {
    assert.match(patternEditor, new RegExp(`\\b${field}\\b`), `pattern editor missing ${field}`);
  }
  assert.match(patternEditor, /MediaUploadControl/);
  assert.match(patternEditor, /hasUniqueIds\(colorways\)/);
  assert.match(products, /<ProductEditor/);
  assert.match(products, /getProductReferenceCounts/);
  assert.match(products, /buildProductWithFirstVariant/);
  assert.match(products, /FirstProductVariantFields/);
  for (const field of ["title", "description", "sku", "slug", "categoryId", "patternId", "artistId", "price", "compareAt", "colors", "sizes", "specs", "materials", "familyId", "order"]) {
    assert.match(productEditor, new RegExp(`\\b${field}\\b`), `product editor missing ${field}`);
  }
  assert.match(productEditor, /buildProductWithFirstVariant/);
  assert.match(productEditor, /hasUniqueIds\(form\.colors\)/);
  assert.match(productEditor, /فهرست فعلی در کد سایت تعریف شده است/);
  assert.match(products, /فهرست خانواده‌ها در کد سایت تعریف شده/);
  assert.match(productEditor, /MediaUploadControl/);
});

test("artist and portfolio editors persist profile services, story blocks, media, and catalog links", () => {
  const artistsManager = fs.readFileSync("src/components/admin/ArtistsManager.tsx", "utf8");
  const artistEditor = fs.readFileSync("src/components/admin/ArtistEditor.tsx", "utf8");
  const portfolioManager = fs.readFileSync("src/components/admin/PortfoliosManager.tsx", "utf8");
  const portfolioPage = fs.readFileSync("src/app/[locale]/portfolio/[slug]/page.tsx", "utf8");
  assert.match(artistsManager, /<ArtistEditor/);
  for (const field of ["name", "slug", "profession", "bio", "avatar", "cover", "location", "social", "tags", "revenueSharePct", "licenseType", "services", "acceptsCommissions", "commissionNotice"]) {
    assert.match(artistEditor, new RegExp(`\\b${field}\\b`), `artist editor missing ${field}`);
  }
  assert.match(artistEditor, /MediaUploadControl/);
  assert.match(artistEditor, /validateArtistServices\(services\)/);
  assert.match(portfolioManager, /<PortfolioEditDrawer/);
  for (const field of ["story", "patternIds", "productIds", "MediaUploadControl", "draftStatus"]) {
    assert.match(portfolioManager, new RegExp(`\\b${field}\\b`), `portfolio editor missing ${field}`);
  }
  for (const type of ["image", "pair", "quote"]) {
    assert.ok(portfolioPage.includes(`b.type === "${type}"`), `public portfolio renderer missing ${type} blocks`);
  }
  assert.match(portfolioPage, /b\.text \? t\(b\.text, locale\)/, "public portfolio renderer has no default text-block renderer");
});

test("home-section guidance matches static content and the actual contact/newsletter endpoints", () => {
  const manager = fs.readFileSync("src/components/admin/HomeSectionsManager.tsx", "utf8");
  const newsletterApi = fs.readFileSync("src/app/api/newsletter/route.ts", "utf8");
  const contactApi = fs.readFileSync("src/app/api/contact/route.ts", "utf8");
  assert.match(manager, /دیکشنری دوزبانه/);
  assert.match(manager, /اولین پورتفولیو/);
  assert.match(manager, /چهارمین پورتفولیو/);
  assert.match(manager, /\/api\/newsletter/);
  assert.match(manager, /\/api\/contact/);
  assert.match(manager, /ذخیره یا ایمیل نمی‌کند/);
  assert.match(manager, /فهرست یا سامانهٔ ایمیلی ذخیره نمی‌کند/);
  assert.match(manager, /فقط پاسخ آزمایشی موفق می‌دهد/);
  assert.match(newsletterApi, /Integration point: connect to your ESP \/ CRM here/);
  assert.match(newsletterApi, /return NextResponse\.json\(\{ ok: true \}\)/);
  assert.match(contactApi, /Integration point: forward to CRM \/ email/);
  assert.match(contactApi, /REQ-\$\{Date\.now\(\)/);
  assert.doesNotMatch(manager, /برای ویرایش متن، به تب «بنرها» بروید/);
});
