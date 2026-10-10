import { NextResponse } from "next/server";
import { publicMediaMime, streamPublicMedia } from "@/lib/media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[a-f0-9]{32}\.(?:jpg|png|webp|avif)$/;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const mime = ID_PATTERN.test(id) ? publicMediaMime(id) : null;
  if (!mime) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const rangeHeader = request.headers.get("range");
  const parsed = rangeHeader?.match(/^bytes=(\d+)-(\d*)$/);
  if (rangeHeader && !parsed) return new NextResponse(null, { status: 416, headers: { "accept-ranges": "bytes" } });
  const range = parsed ? { start: Number(parsed[1]), end: parsed[2] ? Number(parsed[2]) : undefined } : undefined;

  try {
    const media = await streamPublicMedia(id, range);
    const start = range?.start ?? 0;
    const end = range?.end === undefined ? media.size - 1 : Math.min(range.end, media.size - 1);
    if (range && (start >= media.size || end < start)) {
      return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${media.size}`, "accept-ranges": "bytes" } });
    }
    const contentLength = range ? end - start + 1 : media.size;
    const headers = new Headers({
      "content-type": mime,
      "content-length": String(contentLength),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
      "content-disposition": `inline; filename="${id}"`,
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    });
    if (range) headers.set("content-range", `bytes ${start}-${end}/${media.size}`);
    return new NextResponse(media.body, { status: range ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ ok: false, error: "media_not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
  }
}
