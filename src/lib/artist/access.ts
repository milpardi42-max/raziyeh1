import "server-only";

import { getContent } from "@/lib/data/store";
import { isPublicArtist } from "@/lib/artist/public-profile";
import type { ArtistStatus } from "@/lib/types";
import type { SessionUser } from "@/lib/session";

export type ArtistApprovalStatus = ArtistStatus | "missing";

/** Resolve approval from the current content store, not the (potentially stale) session cookie. */
export async function getArtistApprovalStatus(
  user: Pick<SessionUser, "id" | "role" | "artistId">,
): Promise<ArtistApprovalStatus> {
  if (user.role === "admin") return "approved";
  if (user.role !== "artist") return "missing";

  const content = await getContent();
  const artist = (user.artistId
    ? content.artists.find((item) => item.id === user.artistId && (!item.userId || item.userId === user.id))
    : undefined)
    ?? content.artists.find((item) => item.userId === user.id);
  if (!artist) return "missing";
  if (isPublicArtist(artist)) return "approved";
  return artist.status ?? "pending";
}

/** Profile IDs without a matching public/legacy-approved artist fail closed. */
export async function getPublicArtistIds(): Promise<Set<string>> {
  const content = await getContent();
  return new Set(content.artists.filter(isPublicArtist).map((artist) => artist.id));
}

export async function isPublicArtistId(artistId: string | null | undefined): Promise<boolean> {
  if (!artistId) return true;
  return (await getPublicArtistIds()).has(artistId);
}

export function artistApprovalError(status: Exclude<ArtistApprovalStatus, "approved">): string {
  if (status === "pending") return "artist_pending_approval";
  if (status === "rejected") return "artist_application_rejected";
  return "artist_profile_required";
}
