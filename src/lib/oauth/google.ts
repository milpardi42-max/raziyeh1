import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { signPayload } from "@/lib/session";
import { appOrigin } from "@/lib/request-origin";
import { safeReturnPath } from "@/lib/auth/return-path";

/**
 * Google Sign-In — server helpers for the OAuth 2.0 "authorization code" flow.
 *
 * The flow is completely stateless on the server:
 *
 *   1. the browser asks POST /api/auth/google/start to begin,
 *   2. the handler signs a short `state` payload (HMAC-SHA256, same key as the
 *      session cookie) and stores the PKCE verifier in a 10-minute HttpOnly
 *      cookie, then answers with the Google consent URL,
 *   3. Google redirects back to GET /api/auth/google/callback with `code` + `state`,
 *   4. the callback re-verifies the signature, exchanges the code (PKCE) and
 *      reads the identity out of the returned ID token.
 *
 * Environment (see .env.example → "Google Sign-In"):
 *   GOOGLE_CLIENT_ID      — OAuth client id      (required to enable the button)
 *   GOOGLE_CLIENT_SECRET  — OAuth client secret  (required to enable the button)
 *   GOOGLE_REDIRECT_URI   — optional override; defaults to <site origin>/api/auth/google/callback
 *   GOOGLE_ALLOW_SIGNUP   — set to 0 to stop Google from creating brand-new accounts
 */

export const GOOGLE_STATE_COOKIE = "ra-google-oauth";

/** How long a started sign-in may take before the state is rejected. */
export const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

export const GOOGLE_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Explicit redirect URI; when absent it is derived from the incoming request. */
  redirectUri?: string;
  /** false when GOOGLE_ALLOW_SIGNUP=0 — unknown e-mails are then refused. */
  allowSignup: boolean;
}

/** Returns the configuration, or null when Google sign-in is not enabled yet. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GOOGLE_REDIRECT_URI?.trim().replace(/\/+$/, "") || undefined,
    allowSignup: process.env.GOOGLE_ALLOW_SIGNUP !== "0",
  };
}

export function isGoogleConfigured(): boolean {
  return googleConfig() !== null;
}

/** Re-exported so callers can keep importing it from this module. */
export { appOrigin } from "@/lib/request-origin";

export function googleCallbackUrl(req: NextRequest, config: GoogleConfig): string {
  return config.redirectUri ?? `${appOrigin(req)}/api/auth/google/callback`;
}

/* -------------------------------------------------------------- */
/* state (HMAC-signed, round-trips through Google)                */
/* -------------------------------------------------------------- */

/** Page the visitor started from — errors are reported back on the same page. */
export type GoogleEntryPage = "login" | "signup";

export interface GoogleStatePayload {
  /** unique nonce — proves the callback belongs to the flow we started */
  n: string;
  /** locale the visitor should land back on */
  l: Locale;
  /** same-origin path to continue to after a successful sign-in */
  r: string;
  /** entry page, used when the flow has to fail back to the form */
  e: GoogleEntryPage;
  /** issue timestamp (ms) */
  ts: number;
}

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromB64url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

/** Re-exported so callers can keep importing it from this module. */
export { safeReturnPath } from "@/lib/auth/return-path";

export async function createSignedState(
  locale: Locale,
  options: { returnTo?: string | null; entry?: GoogleEntryPage } = {},
): Promise<{ state: string; payload: GoogleStatePayload }> {
  const payload: GoogleStatePayload = {
    n: crypto.randomBytes(16).toString("hex"),
    l: LOCALES.includes(locale) ? locale : "fa",
    r: safeReturnPath(options.returnTo, locale),
    e: options.entry === "signup" ? "signup" : "login",
    ts: Date.now(),
  };
  const body = b64url(JSON.stringify(payload));
  const signature = await signPayload(body);
  return { state: `${body}.${signature}`, payload };
}

export async function verifySignedState(token: string | null | undefined): Promise<GoogleStatePayload | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = await signPayload(body);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body)) as GoogleStatePayload;
    if (typeof payload?.ts !== "number" || Date.now() - payload.ts > GOOGLE_STATE_TTL_MS) return null;
    if (typeof payload.n !== "string" || !payload.n) return null;
    return {
      n: payload.n,
      ts: payload.ts,
      l: LOCALES.includes(payload.l) ? payload.l : "fa",
      r: safeReturnPath(payload.r, payload.l),
      e: payload.e === "signup" ? "signup" : "login",
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- */
/* PKCE                                                           */
/* -------------------------------------------------------------- */

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** The value stored in the short-lived cookie that guards the callback. */
export function packStateCookie(nonce: string, verifier: string): string {
  return b64url(JSON.stringify({ n: nonce, v: verifier }));
}

export function unpackStateCookie(value: string | undefined | null): { n: string; v: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(fromB64url(value)) as { n?: string; v?: string };
    if (!parsed?.n || !parsed?.v) return null;
    return { n: parsed.n, v: parsed.v };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- */
/* authorize URL + token exchange                                 */
/* -------------------------------------------------------------- */

export function buildAuthorizeUrl(
  config: GoogleConfig,
  options: { redirectUri: string; state: string; codeChallenge: string; loginHint?: string },
): string {
  const url = new URL(GOOGLE_AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  // Always let the visitor pick the account instead of silently reusing the last one.
  url.searchParams.set("prompt", "select_account");
  if (options.loginHint) url.searchParams.set("login_hint", options.loginHint);
  return url.toString();
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  locale?: string;
}

export type TokenExchangeResult =
  | { ok: true; idToken: string }
  | { ok: false; error: string };

export async function exchangeCodeForIdToken(
  config: GoogleConfig,
  options: { code: string; codeVerifier: string; redirectUri: string },
): Promise<TokenExchangeResult> {
  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: options.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: options.redirectUri,
        grant_type: "authorization_code",
        code_verifier: options.codeVerifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await res.json().catch(() => null)) as
      | { id_token?: string; error?: string; error_description?: string }
      | null;

    if (!res.ok || !data?.id_token) {
      return { ok: false, error: data?.error ?? `token_http_${res.status}` };
    }
    return { ok: true, idToken: data.id_token };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "token_timeout" : "token_request_failed" };
  }
}

/**
 * Reads the identity out of the ID token.
 *
 * The token was received directly from Google's token endpoint over TLS in the
 * step above (the standard authorization-code exchange), which is exactly the
 * case Google documents as safe to consume without re-checking the signature —
 * there is no path by which a third party could inject a different token here.
 * The claims are still validated strictly, and the e-mail must be verified by
 * Google before an account is created or a session is issued.
 */
export function readIdentity(idToken: string, clientId: string, expectedNonce?: string): GoogleIdentity | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }

  const aud = typeof claims.aud === "string" ? claims.aud : null;
  const iss = typeof claims.iss === "string" ? claims.iss : "";
  const exp = typeof claims.exp === "number" ? claims.exp : 0;

  if (aud !== clientId) return null;
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return null;
  if (exp * 1000 <= Date.now()) return null;
  if (expectedNonce && typeof claims.nonce === "string" && claims.nonce !== expectedNonce) return null;

  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  if (!email || !sub) return null;

  const rawName = typeof claims.name === "string" ? claims.name.trim() : "";
  return {
    sub,
    email,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: rawName || email.split("@")[0],
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
    locale: typeof claims.locale === "string" ? claims.locale : undefined,
  };
}
