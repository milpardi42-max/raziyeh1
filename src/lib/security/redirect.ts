/**
 * Defend against open-redirect phishing: only allow relative paths or
 * same-origin absolute URLs after login/signup etc.
 */

export function safeRedirect(
  target: string | null | undefined,
  fallback = "/",
): string {
  if (!target || typeof target !== "string") return fallback;
  const trimmed = target.trim();
  if (!trimmed) return fallback;
  // Protocol-relative URLs (//evil.com) are rejected
  if (trimmed.startsWith("//")) return fallback;
  // Absolute URL: only http(s) and same-origin is allowed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
      // Caller is responsible for comparing origins; treat any absolute URL as
      // external and fall back to avoid open-redirect surprises.
      return fallback;
    } catch {
      return fallback;
    }
  }
  // Only relative paths starting with / (not \ or /\) are allowed
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("/\\")) return fallback;
  return trimmed;
}
