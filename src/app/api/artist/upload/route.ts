import { NextResponse } from "next/server";
import { getAdminSession, getSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { clientIp, tooManyAttempts, recordAttempt, retryAfterSeconds } from "@/lib/rate-limit";
import { storePublicMedia } from "@/lib/media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
}

/** Artist/admin image uploads are stored in the configured first-party object store. */
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "artist" && !(await getAdminSession())) return unauthorized();

  const rateKey = `upload:${clientIp(req)}`;
  if (tooManyAttempts(rateKey)) {
    const response = NextResponse.json({ ok: false, error: "too_many_attempts" }, withNoStore({ status: 429 }));
    const retry = retryAfterSeconds(rateKey);
    if (retry > 0) response.headers.set("retry-after", String(retry));
    return response;
  }
  recordAttempt(rateKey);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form_data" }, withNoStore({ status: 400 }));
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "missing_file" }, withNoStore({ status: 400 }));
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "unsupported_type", allowed: ALLOWED }, withNoStore({ status: 415 }));
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large", maxBytes: MAX_BYTES }, withNoStore({ status: 413 }));
  }

  try {
    const saved = await storePublicMedia(Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ ok: true, url: saved.url, sizeBytes: file.size, mime: saved.mime }, withNoStore());
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_media_data") {
      return NextResponse.json({ ok: false, error: "invalid_image_data" }, withNoStore({ status: 415 }));
    }
    console.error("[artist/upload] media storage error:", error);
    return NextResponse.json({ ok: false, error: "storage_error" }, withNoStore({ status: 502 }));
  }
}
