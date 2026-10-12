import type { Metadata } from "next";
import { getSite } from "@/lib/data/queries";
import type { Locale } from "@/lib/i18n/types";
import { createSeoMetadata } from "@/lib/seo-pages";

/** Applies admin-managed metadata to a stable public route and emits route-specific canonical/OG metadata. */
export async function getEditableRouteMetadata(
  path: string,
  locale: Locale,
  fallbackTitle: string,
  fallbackDescription?: string,
): Promise<Metadata> {
  const site = await getSite();
  return createSeoMetadata(site.seo ?? [], path, locale, fallbackTitle, fallbackDescription);
}
