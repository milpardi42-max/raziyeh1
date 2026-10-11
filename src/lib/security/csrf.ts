/**
 * Lightweight CSRF protection using the double-submit-cookie pattern.
 *
 * Edge-compatible — this module is used by middleware so it cannot import Node's
 * `crypto` module. It uses the WebCrypto API (`crypto.getRandomValues`) available
 * in both Edge Runtime and Node.js 19+.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export const CSRF_COOKIE = "ra-csrf";
export const CSRF_HEADER = "x-csrf-token";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function isEmbeddedPreviewHost(hostname: string): boolean {
  return [".e2b.app", ".webcontainer-api.io", ".local-credentialless.webcontainer-api.io", ".stackblitz.io"]
    .some((suffix) => hostname.endsWith(suffix));
}

function cookieOptions(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = forwardedHost || req.headers.get("host");
  const hostname = (hostHeader ? hostHeader.replace(/:\d+$/, "") : new URL(req.url).hostname).toLowerCase();
  const isEmbedded = isEmbeddedPreviewHost(hostname);
  const isDev = process.env.NODE_ENV !== "production";
  return {
    httpOnly: false, // need JS to read and mirror into header
    sameSite: isEmbedded ? ("none" as const) : ("lax" as const),
    secure: !isDev || isEmbedded,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    ...(isEmbedded ? { partitioned: true } : {}),
  };
}

/** Generate a fresh random token using WebCrypto (works in Edge). */
export function generateToken(): string {
  const arr = new Uint8Array(32);
  // WebCrypto global — present in Edge Runtime, browsers, and Node >=19.
  (globalThis.crypto as Crypto).getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Plant a CSRF cookie if none exists, and return the token. */
export function ensureCsrfToken(req: NextRequest, res: NextResponse): string {
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  if (existing && existing.length >= 32) return existing;
  const token = generateToken();
  res.cookies.set(CSRF_COOKIE, token, cookieOptions(req));
  return token;
}

/**
 * Public host of this deployment, proxy-aware (the preview platform terminates
 * TLS in front of the app and forwards the real host).
 */
function requestHost(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || req.headers.get("host") || "";
  return host.replace(/:\d+$/, "").toLowerCase();
}

/**
 * True when the browser itself vouches for the request origin.
 *
 * `Sec-Fetch-Site` and `Origin` are set by the browser and cannot be forged or
 * suppressed by page scripts, so a same-origin value proves the request was
 * started by this site rather than by a cross-site attacker — the standard
 * "Fetch Metadata" CSRF defence.
 *
 * This matters beyond theory: inside the embedded preview iframe the CSRF
 * cookie is a third-party cookie, which some browsers refuse to store. The
 * cookie dance then fails even though the request is perfectly legitimate, so
 * the browser's own statement about its origin is the reliable signal there.
 */
export function isSameOriginRequest(req: NextRequest): boolean {
  const expected = requestHost(req);
  if (!expected) return false;

  if (req.headers.get("sec-fetch-site")?.trim().toLowerCase() === "same-origin") return true;

  // `Origin` is sent for every state-changing same-origin request by all modern
  // browsers; `Referer` is the fallback for the rare proxy that drops it. Both
  // are browser-controlled, so a cross-site page can only ever present its own
  // address (or none, which then falls through to the cookie check).
  for (const header of ["origin", "referer"] as const) {
    const value = req.headers.get(header);
    if (!value) continue;
    try {
      // Compare host names only: proxies may keep or drop the port, and the
      // expected host is already normalised without it.
      if (new URL(value).hostname.toLowerCase() === expected) return true;
    } catch {
      // malformed header — keep looking
    }
  }
  return false;
}

/** Validate the CSRF header against the cookie on mutating requests. */
export function verifyCsrf(
  req: NextRequest,
  cookies: ReadonlyRequestCookies,
): { ok: true } | { ok: false; error: string } {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return { ok: true };

  if (process.env.NODE_ENV !== "production" && process.env.ROSIE_ADMIN_BYPASS === "1") {
    return { ok: true };
  }

  // Preferred signal: the browser says the request is same-origin.
  if (isSameOriginRequest(req)) return { ok: true };

  const cookieToken = cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) {
    // Keep a short trace in the server log: a failing browser request can then
    // be diagnosed without guessing which part of the handshake was missing.
    console.warn(
      "[csrf] rejected request",
      JSON.stringify({
        url: req.nextUrl.pathname,
        method: req.method,
        host: requestHost(req),
        cookie: Boolean(cookieToken),
        header: Boolean(headerToken),
        secFetchSite: req.headers.get("sec-fetch-site"),
        origin: req.headers.get("origin"),
        referer: req.headers.get("referer")?.slice(0, 120),
      }),
    );
    return { ok: false, error: "csrf_missing" };
  }
  if (!timingSafeEqualStr(cookieToken, headerToken)) return { ok: false, error: "csrf_mismatch" };
  return { ok: true };
}
