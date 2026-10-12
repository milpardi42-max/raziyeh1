import type { ArtistServiceItem } from "@/lib/types";

export function hasUniqueIds(items: readonly { id: string }[]): boolean {
  const ids = items.map((item) => typeof item.id === "string" ? item.id.trim() : "");
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}

export type ArtistServiceValidationError = "duplicate-id" | "incomplete-active-service";

/** Disabled services may be drafted empty, but cannot be activated without complete public details. */
export function validateArtistServices(
  services: readonly ArtistServiceItem[],
): ArtistServiceValidationError | null {
  if (!hasUniqueIds(services)) return "duplicate-id";

  const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const hasPrice = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const incompleteActiveService = services.some((service) => service.active !== false && (
    !hasText(service.title?.fa)
    || !hasText(service.description?.fa)
    || !hasPrice(service.price?.fa)
    || !hasPrice(service.price?.en)
  ));

  return incompleteActiveService ? "incomplete-active-service" : null;
}
