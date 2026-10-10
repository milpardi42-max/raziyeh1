import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasGrantedReservation, isFreePrice } from "@/lib/academy-live";
import { getContent } from "@/lib/data/store";
import { getAllReservations } from "@/lib/data/reservations";
import { objectSize, getStream } from "@/lib/marketplace/storage";
import { firstPartyMediaUrl, publicMediaMime, streamPublicMedia } from "@/lib/media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const PRIVATE_KEY_PATTERN = /^private\/academy\/videos\/(cv_[a-f0-9]{32})\.(mp4|webm)$/;

function rangeFromHeader(header: string | null): { start: number; end?: number } | null | false {
  if (!header) return null;
  const match = header.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return false;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;
  if (!Number.isSafeInteger(start) || (end !== undefined && (!Number.isSafeInteger(end) || end < start))) return false;
  return { start, ...(end !== undefined ? { end } : {}) };
}

function rangeNotSatisfiable(size: number) {
  return new NextResponse(null, {
    status: 416,
    headers: { "accept-ranges": "bytes", "content-range": `bytes */${size}`, "cache-control": "private, no-store" },
  });
}

function legacySource(videoUrl: string): string | null {
  try {
    const parsed = new URL(videoUrl, "https://rosieatelier.com");
    if (parsed.pathname === "/api/media/legacy") {
      const source = parsed.searchParams.get("url") ?? "";
      return firstPartyMediaUrl(source) !== source ? source : null;
    }
    const absolute = new URL(videoUrl);
    return firstPartyMediaUrl(absolute.toString()) !== absolute.toString() ? absolute.toString() : null;
  } catch {
    return null;
  }
}

/** Stream one course video after checking the current course's preview/enrolment entitlement. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return new NextResponse(null, { status: 404, headers: { "cache-control": "private, no-store" } });

  const [site, reservations, session] = await Promise.all([getContent(), getAllReservations(), getSession()]);
  const course = site.education.find((item) => item.type === "course" && item.videoFiles?.some((video) => video.id === id));
  const video = course?.videoFiles?.find((entry) => entry.id === id);
  if (!course || !video) return new NextResponse(null, { status: 404, headers: { "cache-control": "private, no-store" } });

  const linkedLesson = course.lessonList?.find((lesson) => lesson.id === video.lessonId);
  const isPublicPreview = video.free === true || linkedLesson?.free === true;
  const canAccess = isPublicPreview
    || isFreePrice(course.price)
    || hasGrantedReservation(reservations, course.slug, session);
  if (!canAccess) return NextResponse.json({ ok: false, error: "access_denied" }, { status: 403, headers: { "cache-control": "private, no-store" } });

  const requestRange = rangeFromHeader(request.headers.get("range"));
  if (requestRange === false) return rangeNotSatisfiable(0);

  let stream: Awaited<ReturnType<typeof getStream>>;
  let mime: string;
  let size: number;

  const privateMatch = video.storageKey?.match(PRIVATE_KEY_PATTERN);
  if (privateMatch && privateMatch[1] === id) {
    mime = privateMatch[2] === "mp4" ? "video/mp4" : "video/webm";
    size = await objectSize(video.storageKey!);
    if (!size) return new NextResponse(null, { status: 404, headers: { "cache-control": "private, no-store" } });
    if (requestRange && requestRange.start >= size) return rangeNotSatisfiable(size);
    const end = requestRange?.end === undefined ? size - 1 : Math.min(requestRange.end, size - 1);
    stream = await getStream(video.storageKey!, requestRange ? { start: requestRange.start, end } : undefined);
  } else {
    // Old public records may be previewed if explicitly free. Paid legacy public URLs must be
    // re-uploaded into private storage before they can be treated as protected lessons.
    if (!canAccess || (!isPublicPreview && !isFreePrice(course.price))) {
      return NextResponse.json({ ok: false, error: "video_requires_private_reupload" }, { status: 409, headers: { "cache-control": "private, no-store" } });
    }
    const publicId = video.url.match(/\/api\/media\/([a-f0-9]{32}\.(?:mp4|webm))(?:$|\?)/)?.[1];
    if (publicId && publicMediaMime(publicId)?.startsWith("video/")) {
      mime = publicMediaMime(publicId)!;
      const key = `public/media/${publicId}`;
      size = await objectSize(key);
      if (!size) return new NextResponse(null, { status: 404, headers: { "cache-control": "private, no-store" } });
      if (requestRange && requestRange.start >= size) return rangeNotSatisfiable(size);
      const end = requestRange?.end === undefined ? size - 1 : Math.min(requestRange.end, size - 1);
      stream = await streamPublicMedia(publicId, requestRange ? { start: requestRange.start, end } : undefined);
    } else {
      const source = legacySource(video.url);
      if (!source) return NextResponse.json({ ok: false, error: "video_requires_private_reupload" }, { status: 409, headers: { "cache-control": "private, no-store" } });
      const response = NextResponse.redirect(source, 302);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("referrer-policy", "no-referrer");
      return response;
    }
  }

  const start = requestRange?.start;
  const end = requestRange ? (requestRange.end === undefined ? size - 1 : Math.min(requestRange.end, size - 1)) : size - 1;
  const headers = new Headers({
    "content-type": mime,
    "accept-ranges": "bytes",
    "content-disposition": "inline",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-origin",
  });
  headers.set("content-length", String(end - (start ?? 0) + 1));
  if (requestRange) headers.set("content-range", `bytes ${start}-${end}/${size}`);
  return new NextResponse(stream.body, { status: requestRange ? 206 : 200, headers });
}
