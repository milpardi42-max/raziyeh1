import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasGrantedReservation, isFreePrice, safeExternalHttpsUrl } from "@/lib/academy-live";
import { getContent } from "@/lib/data/store";
import { getAllReservations } from "@/lib/data/reservations";
import { withNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;
const MEDIA_TYPES = new Set([
  "video/mp2t", "video/mp4", "audio/mp2t", "audio/mp4", "audio/aac", "audio/mpeg",
  "application/octet-stream", "application/aac", "application/id3", "application/mp4",
]);

function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, withNoStore({ status }));
}

function targetFrom(request: Request, source: URL, base: URL): URL | null {
  const value = new URL(request.url).searchParams.get("resource");
  if (!value) return source;
  if (value.length > 2048) return null;
  try {
    const target = new URL(value);
    if (safeExternalHttpsUrl(target.href) === null || target.origin !== base.origin) return null;
    return target;
  } catch {
    return null;
  }
}

function proxiedUrl(slug: string, target: URL) {
  return `/api/webinar/${encodeURIComponent(slug)}/stream?resource=${encodeURIComponent(target.href)}`;
}

function rewritePlaylist(text: string, playlistUrl: URL, slug: string, origin: string): string | null {
  const rewrite = (value: string): string | null => {
    try {
      const target = new URL(value, playlistUrl);
      if (safeExternalHttpsUrl(target.href) === null || target.origin !== origin) return null;
      return proxiedUrl(slug, target);
    } catch {
      return null;
    }
  };

  const lines = text.split(/\r?\n/);
  const output: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      output.push(line);
      continue;
    }
    if (trimmed.startsWith("#")) {
      let invalid = false;
      const rewritten = line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        const next = rewrite(uri);
        if (!next) invalid = true;
        return next ? `URI="${next}"` : "URI=\"\"";
      });
      if (invalid) return null;
      output.push(rewritten);
      continue;
    }
    const next = rewrite(trimmed);
    if (!next) return null;
    output.push(next);
  }
  return output.join("\n");
}

/** Same-origin, entitlement-checked HLS proxy. Playlist segment/key URIs are rewritten through this route. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [content, reservations, session] = await Promise.all([getContent(), getAllReservations(), getSession()]);
  const event = content.education.find((item) => item.slug === slug && item.type === "webinar");
  const configured = event?.liveEvent?.webinarStream;
  const base = safeExternalHttpsUrl(configured?.source === "external" ? configured.hlsUrl : undefined);
  if (!event || !base) return errorResponse("stream_not_configured", 404);

  if (!isFreePrice(event.price) && !hasGrantedReservation(reservations, slug, session)) {
    return errorResponse("access_denied", 403);
  }

  const target = targetFrom(request, base, base);
  if (!target) return errorResponse("invalid_stream_resource", 400);
  const range = request.headers.get("range");
  if (range && !/^bytes=\d+-\d*$/.test(range)) return new NextResponse(null, { status: 416, headers: { "accept-ranges": "bytes", "cache-control": "private, no-store" } });

  try {
    const upstream = await fetch(target, {
      headers: range ? { range } : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) return errorResponse("stream_redirect_not_allowed", 502);
    if (!upstream.ok && upstream.status !== 206) return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502, headers: { "cache-control": "private, no-store" } });

    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const isPlaylist = /mpegurl/.test(contentType) || target.pathname.toLowerCase().endsWith(".m3u8");
    if (isPlaylist) {
      const length = Number(upstream.headers.get("content-length") ?? 0);
      if (length > MAX_PLAYLIST_BYTES) return errorResponse("playlist_too_large", 502);
      const text = await upstream.text();
      if (new TextEncoder().encode(text).byteLength > MAX_PLAYLIST_BYTES) return errorResponse("playlist_too_large", 502);
      const rewritten = rewritePlaylist(text, target, slug, base.origin);
      if (rewritten === null) return errorResponse("unsupported_playlist_target", 502);
      return new NextResponse(rewritten, {
        status: upstream.status,
        headers: {
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          "cross-origin-resource-policy": "same-origin",
        },
      });
    }

    if (!MEDIA_TYPES.has(contentType) || !upstream.body) return errorResponse("invalid_stream_response", 502);
    const headers = new Headers({
      "content-type": contentType,
      "accept-ranges": upstream.headers.get("accept-ranges") ?? "bytes",
      "cache-control": "private, no-store",
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
    return errorResponse("stream_unavailable", 502);
  }
}
