import type { NextRequest } from "next/server";

/**
 * Absolute public origin of the running app.
 *
 * NEXT_PUBLIC_SITE_URL wins (production must set it, so links in e-mails always
 * point at the real domain). Otherwise the proxy headers of the current request
 * are used, which keeps development, previews and single-node deployments on the
 * same host the visitor is actually browsing.
 */
export function appOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host") || "";
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}
