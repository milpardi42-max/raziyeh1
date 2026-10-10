/**
 * Security headers applied at the edge via middleware.
 *
 *   - Per-request script nonce. The middleware forwards the CSP to Next.js so
 *     the App Router can nonce its streaming/hydration scripts; strict-dynamic
 *     then allows only those trusted roots and scripts they load.
 *   - Inline styles are allowed for React style props and CSS variables.
 *   - HSTS with preload for HTTPS deployments.
 *   - Anti-clickjacking, with same-origin framing for embedded previews.
 *   - Referrer-Policy, Permissions-Policy, and X-Content-Type-Options.
 */

import { NextResponse, type NextRequest } from "next/server";

function isEmbeddedPreviewHost(hostname: string): boolean {
  return [".e2b.app", ".webcontainer-api.io", ".local-credentialless.webcontainer-api.io", ".stackblitz.io"]
    .some((suffix) => hostname.endsWith(suffix));
}

function requestHostname(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host")?.split(",")[0] || req.headers.get("host") || "")
    .replace(/:\d+$/, "")
    .toLowerCase();
}

/** CSP used for both the forwarded request (Next.js nonce extraction) and response. */
export function createContentSecurityPolicy(req: NextRequest, nonce?: string): string {
  const isEmbedded = isEmbeddedPreviewHost(requestHostname(req));
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSources = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])]
    // JSON/API responses do not render scripts. Page requests always receive a nonce in middleware.
    : ["'self'"];

  const cspDirectives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSources],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
    ["font-src", ["'self'", "https://fonts.gstatic.com", "data:"]],
    ["img-src", ["'self'", "blob:", "data:", "https:", "http:"]],
    ["media-src", ["'self'", "blob:", "data:", "https:"]],
    ["connect-src", ["'self'", "https:", "wss:", "ws:"]],
    ["frame-src", ["'self'", "https://www.youtube.com", "https://player.vimeo.com"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", isEmbedded ? ["'self'"] : ["'none'"]],
    ["upgrade-insecure-requests", []],
  ];

  return cspDirectives
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

export function applySecurityHeaders(req: NextRequest, res: NextResponse, nonce?: string): NextResponse {
  const isEmbedded = isEmbeddedPreviewHost(requestHostname(req));
  const isDev = process.env.NODE_ENV !== "production";
  const headers = res.headers;

  // We never let any other origin frame this site except the preview hosts.
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", isEmbedded ? "SAMEORIGIN" : "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");

  if (!isDev) {
    // HSTS — 1 year + preload. Safe even behind previews (the CDN terminates TLS).
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  headers.set("Content-Security-Policy", createContentSecurityPolicy(req, nonce));
  return res;
}
