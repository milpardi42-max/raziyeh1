import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { clientIp, tooManyAttempts, recordAttempt, retryAfterSeconds } from "@/lib/rate-limit";
import { ACADEMY_VIDEO_ID_PATTERN, academyVideoStorageKey, newAcademyVideoId } from "@/lib/media-storage";
import { presignUpload, storageBackend } from "@/lib/marketplace/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function fail(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, withNoStore({ status }));
}

/** Create a short-lived, admin-only direct PUT for S3-compatible private storage. */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return fail("unauthorized", 401);

  const rateKey = `upload:${clientIp(request)}-academy`;
  if (tooManyAttempts(rateKey)) {
    const response = fail("too_many_attempts", 429);
    const retry = retryAfterSeconds(rateKey);
    if (retry > 0) response.headers.set("retry-after", String(retry));
    return response;
  }
  recordAttempt(rateKey);

  const body = await request.json().catch(() => null) as { mime?: unknown; sizeBytes?: unknown } | null;
  if (typeof body?.mime !== "string" || !VIDEO_TYPES.has(body.mime)
    || typeof body.sizeBytes !== "number" || !Number.isSafeInteger(body.sizeBytes)
    || body.sizeBytes < 12 || body.sizeBytes > MAX_VIDEO_BYTES) {
    return fail("invalid_video_upload", 400, { maxBytes: MAX_VIDEO_BYTES });
  }

  if (storageBackend() === "local") return NextResponse.json({ ok: true, mode: "proxy" }, withNoStore());

  const id = newAcademyVideoId();
  if (!ACADEMY_VIDEO_ID_PATTERN.test(id)) return fail("upload_setup_failed", 500);
  const key = academyVideoStorageKey(id, body.mime);
  if (!key) return fail("unsupported_video_type", 415);
  const uploadUrl = presignUpload(key, 30 * 60);
  if (!uploadUrl) return fail("upload_setup_failed", 503);

  return NextResponse.json({ ok: true, mode: "direct", id, uploadUrl, mime: body.mime, sizeBytes: body.sizeBytes }, withNoStore());
}
