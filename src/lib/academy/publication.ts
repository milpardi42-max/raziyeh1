import type { EducationItem } from "@/lib/types";

/** Legacy academy records without a status stay public; every explicit non-published state is private. */
export function isPublishedEducation(item: Pick<EducationItem, "draftStatus">): boolean {
  return item.draftStatus === undefined || item.draftStatus === "published";
}

export function publicEducationItems<T extends Pick<EducationItem, "draftStatus">>(items: T[]): T[] {
  return items.filter(isPublishedEducation);
}
