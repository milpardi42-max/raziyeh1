import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { ACADEMY_VIDEO_ID_PATTERN, verifyPrivateAcademyVideoUpload } from "@/lib/media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, withNoStore({ status }));
}

/** Confirm object size and media signature before an uploaded private object can be attached to a course. */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return fail("unauthorized", 401);

  const body = await request.json().catch(() => null) as { id?: unknown; mime?: unknown; sizeBytes?: unknown } | null;
  if (typeof body?.id !== "string" || !ACADEMY_VIDEO_ID_PATTERN.test(body.id)
    || typeof body.mime !== "string" || !["video/mp4", "video/webm"].includes(body.mime)
    || typeof body.sizeBytes !== "number" || !Number.isSafeInteger(body.sizeBytes)
    || body.sizeBytes < 12 || body.sizeBytes > MAX_VIDEO_BYTES) {
    return fail("invalid_video_upload", 400);
  }

  try {
    const video = await verifyPrivateAcademyVideoUpload(body.id, body.mime, body.sizeBytes);
    return NextResponse.json({ ok: true, video }, withNoStore());
  } catch (error) {
    const code = error instanceof Error ? error.message : "storage_error";
    const status = code === "invalid_video_data" ? 415 : code === "video_size_mismatch" ? 409 : 502;
    if (status === 502) console.error("[academy/upload-video/complete] verification failed:", error);
    return fail(code, status);
  }
}
