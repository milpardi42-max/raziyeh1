import type { Category, SiteContent } from "@/lib/types";

type PortfolioCategorySource = Pick<SiteContent, "categories" | "portfolios" | "portfolioCategories">;

/** Dedicated portfolio categories plus legacy general categories still used by old works. */
export function getPortfolioCategories(site: PortfolioCategorySource): Category[] {
  const dedicated = site.portfolioCategories ?? [];
  const known = new Set(dedicated.map((category) => category.id));
  const legacyIds = new Set(site.portfolios.map((portfolio) => portfolio.categoryId));
  const legacy = site.categories.filter((category) => legacyIds.has(category.id) && !known.has(category.id));
  return [...dedicated, ...legacy].sort((a, b) => a.order - b.order || a.name.fa.localeCompare(b.name.fa, "fa"));
}

/** Public filter chips only include categories that currently contain a portfolio. */
export function getUsedPortfolioCategories(site: PortfolioCategorySource): Category[] {
  const used = new Set(site.portfolios.map((portfolio) => portfolio.categoryId));
  return getPortfolioCategories(site).filter((category) => used.has(category.id));
}
