import type { Locale } from "@/lib/i18n/types";

/**
 * Only same-origin, locale-prefixed paths may be used as a post-login target.
 * Anything else (absolute URLs, protocol-relative `//evil.com`, API or admin
 * routes) falls back to the visitor's account page — this is what keeps the
 * "returnTo" value from turning into an open redirect.
 */
export function safeReturnPath(value: string | undefined | null, locale: Locale): string {
  const fallback = `/${locale}/account`;
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.startsWith("/api/") || trimmed.startsWith("/admin")) return fallback;
  return trimmed.slice(0, 300);
}
