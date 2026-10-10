import type { Portfolio } from "@/lib/types";

/** Legacy CMS projects stay in the studio gallery; self-service works stay with their artist. */
export function isStudioPortfolio(work: Portfolio): boolean {
  return (
    work.showcase === "site" ||
    (work.showcase !== "artist" && work.draftStatus === undefined)
  );
}

export function isPublishedPortfolio(work: Portfolio): boolean {
  return work.draftStatus === undefined || work.draftStatus === "published";
}

export function artistPortfolioWorks(
  works: Portfolio[],
  artistId: string,
): Portfolio[] {
  return works.filter(
    (work) => work.artistId === artistId && isPublishedPortfolio(work),
  );
}

export function artistPortfolioPath(
  artistSlug: string,
  workSlug?: string,
): string {
  const base = `/artists/${encodeURIComponent(artistSlug)}/portfolio`;
  return workSlug ? `${base}/${encodeURIComponent(workSlug)}` : base;
}
