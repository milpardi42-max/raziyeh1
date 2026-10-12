import type { SiteContent } from "./types";

export type CategoryReferenceSource = Pick<
  SiteContent,
  "patterns" | "products" | "education" | "portfolios"
>;

export interface CategoryUsageCounts {
  patterns: number;
  products: number;
  education: number;
  portfolios: number;
}

/** Count every persisted reference before removing a shared catalog category. */
export function getCategoryUsageCounts(
  content: CategoryReferenceSource,
  categoryId: string,
): CategoryUsageCounts {
  return {
    patterns: content.patterns.filter((item) => item.categoryId === categoryId).length,
    products: content.products.filter((item) => item.categoryId === categoryId).length,
    education: content.education.filter((item) => item.categoryId === categoryId).length,
    portfolios: content.portfolios.filter((item) => item.categoryId === categoryId).length,
  };
}

export function hasCategoryReferences(usage: CategoryUsageCounts): boolean {
  return Object.values(usage).some((count) => count > 0);
}
