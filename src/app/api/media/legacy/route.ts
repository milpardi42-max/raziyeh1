import { NextResponse } from "next/server";
import { firstPartyMediaUrl } from "@/lib/media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/**
 * Transitional same-origin proxy for old public Cloudinary/Vercel uploads.
 * The source URL is strictly allow-listed in media-storage.ts; arbitrary URLs,
 * private hosts, redirects and non-media payloads are never fetched.
 */
export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url") ?? "";
  const wrapped = firstPartyMediaUrl(source);
  if (!source || source.length > 2048 || wrapped === source) {
    return NextResponse.json({ ok: false, error: "unsupported_media_source" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const range = request.headers.get("range");
  if (range && !/^bytes=\d+-\d*$/.test(range)) {
    return new NextResponse(null, { status: 416, headers: { "accept-ranges": "bytes" } });
  }
  try {
    const upstream = await fetch(source, {
      headers: range ? { range } : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ ok: false, error: "media_redirect_not_allowed" }, { status: 502, headers: { "cache-control": "no-store" } });
    }
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502, headers: { "cache-control": "no-store" } });
    }
    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!TYPES.has(contentType) || !upstream.body) {
      return NextResponse.json({ ok: false, error: "invalid_media_response" }, { status: 502, headers: { "cache-control": "no-store" } });
    }
    const headers = new Headers({
      "content-type": contentType,
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=1800, stale-while-revalidate=86400",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    });
    for (const name of ["content-length", "content-range"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ ok: false, error: "legacy_media_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
