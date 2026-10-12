import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/product-variants.ts", "utf8");
const exports = {};
new Function(
  "exports",
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exports);

const {
  buildProductWithFirstVariant,
  getProductColor,
  hasProductVariants,
  isProductVariantPurchasable,
} = exports;

const productBase = {
  id: "prod-1",
  sku: "PROD-001",
  slug: "prod-001",
  title: { fa: "محصول", en: "Product" },
  description: { fa: "", en: "" },
  categoryId: "home",
  familyId: null,
  patternId: null,
  artistId: null,
  price: { fa: 100, en: 10 },
  sizes: [],
  specs: [],
  materials: { fa: "", en: "" },
  featured: false,
  bestSeller: false,
  isNew: true,
  order: 1,
};

const validVariant = {
  id: "color-1",
  nameFa: "کرم روشن",
  nameEn: "Light cream",
  hex: "#F5F0E8",
  image: "/api/media/example.jpg",
  stock: 4,
};

test("new product creation always stores a complete bilingual first variant", () => {
  const result = buildProductWithFirstVariant(productBase, validVariant);
  assert.equal(result.ok, true);
  assert.equal(result.product.colors.length, 1);
  assert.deepEqual(result.product.colors[0], {
    id: "color-1",
    name: { fa: "کرم روشن", en: "Light cream" },
    hex: "#f5f0e8",
    image: "/api/media/example.jpg",
    stock: 4,
  });
  assert.equal(hasProductVariants(result.product), true);
  assert.equal(isProductVariantPurchasable(result.product, "color-1"), true);

  const numericStringStock = buildProductWithFirstVariant(productBase, { ...validVariant, stock: "7" });
  assert.equal(numericStringStock.ok, true);
  assert.equal(numericStringStock.product.colors[0].stock, 7);
});

test("incomplete first variants are rejected instead of saving an empty colors array", () => {
  const invalidCases = [
    [{ ...validVariant, nameFa: "   " }, "name-fa-required"],
    [{ ...validVariant, nameEn: "" }, "name-en-required"],
    [{ ...validVariant, hex: "beige" }, "invalid-color"],
    [{ ...validVariant, image: "  " }, "image-required"],
    [{ ...validVariant, stock: "" }, "invalid-stock"],
    [{ ...validVariant, stock: -1 }, "invalid-stock"],
    [{ ...validVariant, stock: 1.5 }, "invalid-stock"],
    [{ ...validVariant, stock: Number.NaN }, "invalid-stock"],
  ];

  for (const [variant, expectedError] of invalidCases) {
    const result = buildProductWithFirstVariant(productBase, variant);
    assert.equal(result.ok, false);
    assert.equal(result.error, expectedError);
  }
});

test("legacy products without variants resolve to a visible but unbuyable placeholder", () => {
  const legacyProduct = { colors: [] };
  const color = getProductColor(legacyProduct);
  assert.equal(hasProductVariants(legacyProduct), false);
  assert.equal(color.stock, 0);
  assert.equal(color.name.en, "No purchasable variant");
  assert.equal(color.image, "/images/placeholders/product-unavailable.svg");
  assert.equal(isProductVariantPurchasable(legacyProduct), false);
  assert.equal(isProductVariantPurchasable({}), false);
});

test("all admin product-creation entry points use the required first-variant builder", () => {
  for (const file of [
    "src/components/admin/ProductsManager.tsx",
    "src/components/admin/HomeSectionsManager.tsx",
  ]) {
    const component = fs.readFileSync(file, "utf8");
    assert.match(component, /buildProductWithFirstVariant/);
    assert.match(component, /FirstProductVariantFields/);
  }
});
