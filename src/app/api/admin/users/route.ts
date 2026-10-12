import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getContentWithEtag, mutateContent } from "@/lib/data/store";
import { getAllUsers, findUserById, toPublicUser, updateUser, saveAllUsers, createUser, upgradeUserToArtist } from "@/lib/data/users";
import { withNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

/** GET /api/admin/users — list all users (without passwordHash) */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }
  try {
    const users = await getAllUsers({ strict: true });
    return NextResponse.json({ ok: true, users: users.map(toPublicUser) }, withNoStore());
  } catch {
    return NextResponse.json({ ok: false, error: "users_unavailable" }, withNoStore({ status: 503 }));
  }
}

/** PATCH /api/admin/users — update role */
export async function PATCH(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }
  const body = (await req.json().catch(() => null)) as { id?: string; role?: string } | null;
  if (!body?.id || !body?.role) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }
  if (!["user", "artist"].includes(body.role)) {
    return NextResponse.json({ ok: false, error: "invalid_role" }, withNoStore({ status: 400 }));
  }
  const current = await findUserById(body.id);
  if (!current) {
    return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
  }
  if (current.role === "admin") {
    return NextResponse.json({ ok: false, error: "admin_role_protected" }, withNoStore({ status: 409 }));
  }

  if (body.role === "artist") {
    const result = await upgradeUserToArtist(current.id);
    if (!result) {
      return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
    }
    const response = NextResponse.json({
      ok: true,
      user: toPublicUser(result.user),
      createdArtistProfile: result.createdProfile,
      ...(result.artist ? { artist: result.artist } : {}),
    }, withNoStore());
    if (result.contentEtag) response.headers.set("ETag", `"${result.contentEtag}"`);
    return response;
  }

  // Role downgrades must go through artist-profile management so they cannot
  // leave an approved public profile linked to a buyer account.
  if (current.role === "artist") {
    return NextResponse.json({ ok: false, error: "artist_profile_management_required" }, withNoStore({ status: 409 }));
  }

  const updated = await updateUser(body.id, { role: "user" });
  if (!updated) {
    return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
  }
  return NextResponse.json({ ok: true, user: toPublicUser(updated) }, withNoStore());
}

/** DELETE /api/admin/users — delete a user by id */
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }
  const users = await getAllUsers();
  const target = users.find((user) => user.id === body.id);
  if (!target) {
    return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
  }

  let mutation: Awaited<ReturnType<typeof mutateContent<string[]>>>;
  try {
    mutation = await mutateContent((content) => {
      const linkedArtistIds = content.artists
        .filter((item) => item.userId === target.id
          || (item.id === target.artistId && (!item.userId || item.userId === target.id)))
        .map((item) => item.id);
      const removed = new Set(linkedArtistIds);
      return {
        content: { ...content, artists: content.artists.filter((item) => !removed.has(item.id)) },
        result: linkedArtistIds,
      };
    });
  } catch (error) {
    console.error("[admin/users] linked artist removal failed:", error);
    return NextResponse.json({ ok: false, error: "content_update_failed" }, withNoStore({ status: 502 }));
  }

  await saveAllUsers(users.filter((user) => user.id !== target.id));
  return withContentEtag(
    NextResponse.json({ ok: true, removedArtistIds: mutation.result }, withNoStore()),
    mutation.etag,
  );
}

/** POST /api/admin/users — create a new user (admin only) */
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  } | null;

  if (!body?.name || !body?.email || !body?.password) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }
  if (body.password.length < 6) {
    return NextResponse.json({ ok: false, error: "password_too_short" }, withNoStore({ status: 400 }));
  }

  const role = body.role === "artist" ? "artist" : "user";

  try {
    const stored = await createUser(body.name, body.email, body.password, role);
    const contentMutation = stored.artistId ? await getContentWithEtag() : null;
    const artist = contentMutation?.[0].artists.find((item) => item.id === stored.artistId);
    const response = NextResponse.json({
      ok: true,
      user: toPublicUser(stored),
      ...(artist ? { artist } : {}),
    }, withNoStore());
    if (artist && contentMutation) response.headers.set("ETag", `"${contentMutation[1]}"`);
    return response;
  } catch (e) {
    if (e instanceof Error && e.message === "email_taken") {
      return NextResponse.json({ ok: false, error: "email_taken" }, withNoStore({ status: 409 }));
    }
    return NextResponse.json({ ok: false, error: "server_error" }, withNoStore({ status: 500 }));
  }
}
