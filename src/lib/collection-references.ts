import type { Collection, Pattern, Product } from "./types";

export interface CollectionReferenceIssues {
  missingPatternIds: string[];
  missingProductIds: string[];
}

/** Find collection links that no longer resolve to a catalog record. */
export function getCollectionReferenceIssues(
  collection: Pick<Collection, "patternIds" | "productIds">,
  patterns: readonly Pick<Pattern, "id">[],
  products: readonly Pick<Product, "id">[],
): CollectionReferenceIssues {
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const productIds = new Set(products.map((product) => product.id));

  return {
    missingPatternIds: [...new Set(collection.patternIds ?? [])].filter((id) => !patternIds.has(id)),
    missingProductIds: [...new Set(collection.productIds ?? [])].filter((id) => !productIds.has(id)),
  };
}
