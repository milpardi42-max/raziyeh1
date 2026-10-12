import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getContent, mutateContent } from "@/lib/data/store";
import { getAllUsers, saveAllUsers } from "@/lib/data/users";
import { withNoStore } from "@/lib/http";
import type { Artist, ArtistStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getAdminSession();
  return session?.role === "admin" ? session : null;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
}

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

/** GET /api/admin/artists — list all artists with their status */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  const content = await getContent();
  return NextResponse.json({ ok: true, artists: content.artists }, withNoStore());
}

/**
 * PATCH /api/admin/artists
 * Body: { id: string; status: ArtistStatus; revenueSharePct?: number; licenseType?: string }
 * Approves, rejects, or updates an artist record.
 */
export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    status?: ArtistStatus;
    revenueSharePct?: number;
    licenseType?: string;
    featured?: boolean;
    rejectionNote?: string;
  } | null;

  if (!body?.id) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  if (body.status !== undefined && !["pending", "approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, withNoStore({ status: 400 }));
  }
  if (body.licenseType !== undefined && !["standard", "exclusive", "custom"].includes(body.licenseType)) {
    return NextResponse.json({ ok: false, error: "invalid_license_type" }, withNoStore({ status: 400 }));
  }

  let mutation: Awaited<ReturnType<typeof mutateContent<Artist>>>;
  try {
    mutation = await mutateContent((content) => {
      const artistIndex = content.artists.findIndex((artist) => artist.id === body.id);
      if (artistIndex === -1) throw new Error("artist_not_found");

      const patch: Partial<(typeof content.artists)[number]> = {};
      if (body.status !== undefined) patch.status = body.status;
      if (body.revenueSharePct !== undefined) {
        patch.revenueSharePct = Math.min(100, Math.max(0, body.revenueSharePct));
      }
      if (body.licenseType !== undefined) {
        patch.licenseType = body.licenseType as "standard" | "exclusive" | "custom";
      }
      if (body.featured !== undefined) patch.featured = body.featured;
      if (body.rejectionNote !== undefined) patch.rejectionNote = body.rejectionNote || undefined;

      const updated = { ...content.artists[artistIndex], ...patch };
      const artists = content.artists.map((artist, index) => index === artistIndex ? updated : artist);
      return { content: { ...content, artists }, result: updated };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "artist_not_found") {
      return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
    }
    console.error("[admin/artists] content mutation failed:", error);
    return NextResponse.json({ ok: false, error: "content_update_failed" }, withNoStore({ status: 502 }));
  }
  const updated = mutation.result;

  // The artist record is the approval source of truth, while the linked user
  // role controls authenticated seller access. Keep both in sync on every admin
  // profile/status edit.
  const users = await getAllUsers();
  const linkedUsers = users.filter((user) =>
    user.role !== "admin" && (user.id === updated.userId || user.artistId === updated.id),
  );
  if (linkedUsers.some((user) => user.role !== "artist" || user.artistId !== updated.id)) {
    const linkedUserIds = new Set(linkedUsers.map((user) => user.id));
    await saveAllUsers(users.map((user) =>
      linkedUserIds.has(user.id) ? { ...user, role: "artist" as const, artistId: updated.id } : user,
    ));
  }

  return withContentEtag(NextResponse.json({ ok: true, artist: updated }, withNoStore()), mutation.etag);
}

/**
 * DELETE /api/admin/artists?id=…
 * Removes the artist record and clears artistId from the linked user account.
 */
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, withNoStore({ status: 400 }));
  }

  let mutation: Awaited<ReturnType<typeof mutateContent<Artist>>>;
  try {
    mutation = await mutateContent((content) => {
      const artist = content.artists.find((item) => item.id === id);
      if (!artist) throw new Error("artist_not_found");
      return {
        content: { ...content, artists: content.artists.filter((item) => item.id !== id) },
        result: artist,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "artist_not_found") {
      return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
    }
    console.error("[admin/artists] content delete failed:", error);
    return NextResponse.json({ ok: false, error: "content_update_failed" }, withNoStore({ status: 502 }));
  }
  const artist = mutation.result;

  // Clear artistId on the linked user.
  if (artist.userId) {
    const users = await getAllUsers();
    const updated = users.map((user) =>
      user.id === artist.userId ? { ...user, artistId: undefined, role: "user" as const } : user,
    );
    await saveAllUsers(updated);
  }

  return withContentEtag(
    NextResponse.json({ ok: true, removedArtistIds: [artist.id] }, withNoStore()),
    mutation.etag,
  );
}
