import type { ColorOption, Product } from "@/lib/types";

export interface FirstProductVariantInput {
  id: string;
  nameFa: string;
  nameEn: string;
  hex: string;
  image: string;
  stock: number | string;
}

export type FirstProductVariantError =
  | "id-required"
  | "name-fa-required"
  | "name-en-required"
  | "invalid-color"
  | "image-required"
  | "invalid-stock";

export type ProductWithFirstVariantResult =
  | { ok: true; product: Product }
  | { ok: false; error: FirstProductVariantError };

export const MISSING_PRODUCT_VARIANT: ColorOption = {
  id: "__missing-product-variant__",
  name: { fa: "واریانت قابل خرید موجود نیست", en: "No purchasable variant" },
  hex: "#e5e7eb",
  image: "/images/placeholders/product-unavailable.svg",
  stock: 0,
};

/**
 * New products must start with a complete, bilingual variant. Keeping this
 * invariant in one place prevents admin entry points from saving colors: [].
 */
export function buildProductWithFirstVariant(
  product: Omit<Product, "colors">,
  input: FirstProductVariantInput,
): ProductWithFirstVariantResult {
  const id = input.id.trim();
  const nameFa = input.nameFa.trim();
  const nameEn = input.nameEn.trim();
  const image = input.image.trim();
  const hex = input.hex.trim();
  const stock = typeof input.stock === "number"
    ? input.stock
    : input.stock.trim() ? Number(input.stock) : Number.NaN;

  if (!id) return { ok: false, error: "id-required" };
  if (!nameFa) return { ok: false, error: "name-fa-required" };
  if (!nameEn) return { ok: false, error: "name-en-required" };
  if (!/^#[\da-f]{6}$/i.test(hex)) return { ok: false, error: "invalid-color" };
  if (!image) return { ok: false, error: "image-required" };
  if (!Number.isSafeInteger(stock) || stock < 0) return { ok: false, error: "invalid-stock" };

  const color: ColorOption = {
    id,
    name: { fa: nameFa, en: nameEn },
    hex: hex.toLowerCase(),
    image,
    stock,
  };

  return { ok: true, product: { ...product, colors: [color] } };
}

type ProductWithOptionalColors = { colors?: ColorOption[] | null } | null | undefined;

export function getProductColors(product: ProductWithOptionalColors): ColorOption[] {
  return Array.isArray(product?.colors) ? product.colors : [];
}

export function hasProductVariants(product: ProductWithOptionalColors): boolean {
  return getProductColors(product).length > 0;
}

/** Returns a zero-stock placeholder for old/incomplete products without variants. */
export function getProductColor(product: ProductWithOptionalColors, colorId?: string): ColorOption {
  const colors = getProductColors(product);
  return colors.find((color) => color.id === colorId) ?? colors[0] ?? MISSING_PRODUCT_VARIANT;
}

export function isProductVariantPurchasable(product: ProductWithOptionalColors, colorId?: string): boolean {
  const colors = getProductColors(product);
  const color = colors.find((option) => option.id === colorId) ?? colors[0];
  return Boolean(color && Number.isFinite(color.stock) && color.stock > 0);
}
