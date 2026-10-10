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

/** Validate the CSRF header against the cookie on mutating requests. */
export function verifyCsrf(
  req: NextRequest,
  cookies: ReadonlyRequestCookies,
): { ok: true } | { ok: false; error: string } {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return { ok: true };

  if (process.env.NODE_ENV !== "production" && process.env.ROSIE_ADMIN_BYPASS === "1") {
    return { ok: true };
  }

  const cookieToken = cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return { ok: false, error: "csrf_missing" };
  if (!timingSafeEqualStr(cookieToken, headerToken)) return { ok: false, error: "csrf_mismatch" };
  return { ok: true };
}
