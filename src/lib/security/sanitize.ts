/**
 * Defensive sanitizer for user-generated content (title/excerpt/body fields
 * entered in admin drawers or artist forms). Content is rendered as React text,
 * so React already escapes it — but stripping active content at write time adds
 * defense in depth if anything ever gets rendered via dangerouslySetInnerHTML.
 */

const BLOCKED_RAW = /<\s*(script|style|iframe|object|embed|svg|math|link|meta|base|form|input|button|textarea|select)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|svg|math|link|meta|base|form)\b[^>]*\/?>/gi;
const EVENTS = /\son[a-z]+\s*=\s*("[\s\S]*?"|'[\s\S]*?'|[^\s>]+)/gi;
const JAVASCRIPT_URL = /(javascript|data|vbscript)\s*:/gi;

export function sanitizePlainText(input: string): string {
  if (!input) return "";
  let out = input;
  // Strip blocked tags (with or without closing tag)
  out = out.replace(BLOCKED_RAW, "");
  // Strip event-handler attributes (onclick=, onerror=, …)
  out = out.replace(EVENTS, "");
  // Defuse javascript:/data: URLs
  out = out.replace(JAVASCRIPT_URL, "blocked:");
  return out;
}

/** Recursively sanitize all string leaves of a JSON object up to a depth limit. */
export function sanitizeDeep<T>(value: T, depth = 0): T {
  if (depth > 8 || value == null) return value;
  if (typeof value === "string") return sanitizePlainText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v, depth + 1)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}
