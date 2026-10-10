import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { clientIp, tooManyAttempts, recordAttempt, retryAfterSeconds } from "@/lib/rate-limit";
import { storePrivateAcademyVideo } from "@/lib/media-storage";
import { storageBackend } from "@/lib/marketplace/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

function fail(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, withNoStore({ status }));
}

/** Local-storage fallback upload. S3 deployments use the direct, signed upload flow. */
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return fail("unauthorized", 401);

  const rateKey = `upload:${clientIp(req)}-academy`;
  if (tooManyAttempts(rateKey)) {
    const response = fail("too_many_attempts", 429);
    const retry = retryAfterSeconds(rateKey);
    if (retry > 0) response.headers.set("retry-after", String(retry));
    return response;
  }
  recordAttempt(rateKey);

  if (storageBackend() !== "local") return fail("use_direct_upload", 409);

  // Reject oversized multipart requests before Next.js parses/materializes the file body.
  const contentLength = req.headers.get("content-length");
  if (!contentLength || !/^\d+$/.test(contentLength)) return fail("content_length_required", 411);
  const requestBytes = Number(contentLength);
  if (!Number.isSafeInteger(requestBytes) || requestBytes > MAX_VIDEO_BYTES + MAX_MULTIPART_OVERHEAD_BYTES) {
    return fail("file_too_large", 413, { maxBytes: MAX_VIDEO_BYTES });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid_form_data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("missing_file", 400);
  if (!VIDEO_TYPES.includes(file.type)) {
    return fail("unsupported_video_type", 415, { allowed: VIDEO_TYPES });
  }
  if (file.size < 12) return fail("invalid_video_data", 415);
  if (file.size > MAX_VIDEO_BYTES) return fail("file_too_large", 413, { maxBytes: MAX_VIDEO_BYTES });

  try {
    const saved = await storePrivateAcademyVideo(file);
    return NextResponse.json({ ok: true, ...saved }, withNoStore());
  } catch (error) {
    if (error instanceof Error && ["invalid_video_data", "unsupported_video_type"].includes(error.message)) {
      return fail(error.message, 415);
    }
    console.error("[academy/upload-video] private storage error:", error);
    return fail("storage_error", 502);
  }
}
