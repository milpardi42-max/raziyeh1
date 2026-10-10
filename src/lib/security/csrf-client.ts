/**
 * Client-side helper that reads the CSRF double-submit cookie (set by
 * middleware on every GET) and attaches its value as X-CSRF-Token for
 * state-changing requests (POST/PUT/PATCH/DELETE).
 */

import { CSRF_COOKIE, CSRF_HEADER } from "./csrf";

function getCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${CSRF_COOKIE}=`;
  for (const part of document.cookie.split(";")) {
    const c = part.trim();
    if (c.startsWith(prefix)) {
      try {
        return decodeURIComponent(c.slice(prefix.length));
      } catch {
        return c.slice(prefix.length);
      }
    }
  }
  return null;
}

export function withCsrf(init: RequestInit = {}): RequestInit {
  const token = getCsrfCookie();
  if (!token) return init;
  const headers = new Headers(init.headers ?? {});
  headers.set(CSRF_HEADER, token);
  // Also send a CSRF-safe content-type so the request isn't a "simple" CORS request.
  if (!headers.has("content-type") && init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  return { ...init, headers };
}

/** Convenience fetch wrapper that auto-includes credentials + CSRF header. */
export async function secureFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, withCsrf({ credentials: "include", ...init }));
}
