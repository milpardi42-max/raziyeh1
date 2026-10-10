import type { SiteContent } from "../types";

/** Counts of published CMS records, never estimates of off-site activity. */
export function siteStatistics(site: SiteContent) {
  return {
    patterns: site.patterns.length,
    artists: site.artists.length,
    projects: site.portfolios.filter((portfolio) => portfolio.isProject).length,
  };
}
