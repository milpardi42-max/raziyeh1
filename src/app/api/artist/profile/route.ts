import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getArtistApprovalStatus } from "@/lib/artist/access";
import { getContent, mutateCollection } from "@/lib/data/store";
import { getAllUsers, saveAllUsers } from "@/lib/data/users";
import { withNoStore } from "@/lib/http";
import { clientIp, tooManyAttempts, recordAttempt } from "@/lib/rate-limit";
import type { Artist } from "@/lib/types";

export const dynamic = "force-dynamic";

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "artist";
}

/** GET /api/artist/profile — returns the artist profile for the logged-in user */
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "artist" && session.role !== "admin")) {
    return unauthorized();
  }

  const content = await getContent();

  const artistId = session.role === "admin"
    ? null // admins use the admin panel; return null to indicate no personal profile
    : session.artistId;

  if (!artistId) {
    return NextResponse.json({ ok: true, artist: null }, withNoStore());
  }

  const artist = content.artists.find((a) => a.id === artistId) ?? null;
  return NextResponse.json({ ok: true, artist }, withNoStore());
}

/**
 * PUT /api/artist/profile — update the artist's own profile.
 *
 * Allowed fields: name, profession, bio, location, social, avatar, cover, tags, licenseType, licenseNote.
 * Slug is re-derived from name if the artist wants a change, with uniqueness enforced.
 * Status and revenueSharePct are read-only for the artist (admin-only via /api/admin/artists).
 */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "artist") return unauthorized();

  const artistId = session.artistId;
  if (!artistId) {
    return NextResponse.json({ ok: false, error: "no_artist_record" }, withNoStore({ status: 400 }));
  }

  const body = (await req.json().catch(() => null)) as Partial<Artist> & { slug?: string } | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  // Rate limit: 30 profile updates per 5 min per IP
  const rlKey = `profile:${clientIp(req)}`;
  if (tooManyAttempts(rlKey)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, withNoStore({ status: 429 }));
  }
  recordAttempt(rlKey);

  const canEditSalesSettings = (await getArtistApprovalStatus(session)) === "approved";

  let mutation;
  try {
    mutation = await mutateCollection("artists", (artists) => {
      const index = artists.findIndex((artist) => artist.id === artistId);
      if (index < 0) throw new Error("artist_not_found");

      const current = artists[index];
      // Validate & deduplicate slug against the latest collection snapshot.
      let slug = current.slug;
      if (body.slug && body.slug !== current.slug) {
        const candidate = toSlug(body.slug);
        const taken = artists.some((artist) => artist.slug === candidate && artist.id !== artistId);
        if (taken) throw new Error("slug_taken");
        slug = candidate;
      } else if (body.name && (body.name.fa !== current.name.fa || body.name.en !== current.name.en)) {
        // Re-derive slug from updated name only if no explicit slug was provided.
        const derived = toSlug(body.name.en || body.name.fa);
        if (derived && derived !== current.slug) {
          const taken = artists.some((artist) => artist.slug === derived && artist.id !== artistId);
          if (!taken) slug = derived;
        }
      }

      // Only allow profile fields here. Sales settings are approved-artist-only;
      // status, revenue share, services, subscriptions and inquiries remain server-managed.
      const updated: Artist = {
        ...current,
        ...(body.name ? { name: body.name } : {}),
        ...(body.profession ? { profession: body.profession } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.location !== undefined ? { location: body.location } : {}),
        ...(body.social !== undefined ? { social: body.social } : {}),
        ...(body.avatar ? { avatar: body.avatar } : {}),
        ...(body.cover ? { cover: body.cover } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(canEditSalesSettings && body.licenseType !== undefined ? { licenseType: body.licenseType } : {}),
        ...(canEditSalesSettings && body.licenseNote !== undefined ? { licenseNote: body.licenseNote } : {}),
        slug,
      };
      const nextArtists = [...artists];
      nextArtists[index] = updated;
      return { items: nextArtists, result: updated };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "artist_not_found") {
      return NextResponse.json({ ok: false, error: "artist_not_found" }, withNoStore({ status: 404 }));
    }
    if (error instanceof Error && error.message === "slug_taken") {
      return NextResponse.json({ ok: false, error: "slug_taken" }, withNoStore({ status: 409 }));
    }
    console.error("Failed to update artist profile", error);
    return NextResponse.json({ ok: false, error: "profile_update_failed" }, withNoStore({ status: 500 }));
  }

  const updated = mutation.result;

  // Sync display name in the user record if it changed
  if (body.name) {
    const displayName = body.name.fa || body.name.en;
    if (displayName && displayName !== session.name) {
      const users = await getAllUsers();
      const updatedUsers = users.map((u) =>
        u.id === session.id ? { ...u, name: displayName } : u,
      );
      await saveAllUsers(updatedUsers);
    }
  }

  return withContentEtag(NextResponse.json({ ok: true, artist: updated }, withNoStore()), mutation.etag);
}
