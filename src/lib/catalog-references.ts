import type { SiteContent } from "./types";

export type CatalogReferenceSource = Pick<
  SiteContent,
  "products" | "portfolios" | "education" | "collections"
>;

export interface PatternReferenceCounts {
  products: number;
  portfolios: number;
  education: number;
  collections: number;
}

export interface ProductReferenceCounts {
  portfolios: number;
  education: number;
  collections: number;
}

export function getPatternReferenceCounts(
  content: CatalogReferenceSource,
  patternId: string,
): PatternReferenceCounts {
  return {
    products: content.products.filter((item) => item.patternId === patternId).length,
    portfolios: content.portfolios.filter((item) => item.patternIds?.includes(patternId)).length,
    education: content.education.filter((item) => item.patternIds?.includes(patternId)).length,
    collections: content.collections.filter((item) => item.patternIds?.includes(patternId)).length,
  };
}

export function getProductReferenceCounts(
  content: CatalogReferenceSource,
  productId: string,
): ProductReferenceCounts {
  return {
    portfolios: content.portfolios.filter((item) => item.productIds?.includes(productId)).length,
    education: content.education.filter((item) => item.productIds?.includes(productId)).length,
    collections: content.collections.filter((item) => item.productIds?.includes(productId)).length,
  };
}

export function hasCatalogReferences(references: object): boolean {
  return Object.values(references).some((count) => typeof count === "number" && count > 0);
}
