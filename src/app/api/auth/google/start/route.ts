import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withNoStore } from "@/lib/http";
import { sessionCookieOptions } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import { sanitizePlainText } from "@/lib/security/sanitize";
import type { NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n/types";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_TTL_MS,
  buildAuthorizeUrl,
  createPkcePair,
  createSignedState,
  googleCallbackUrl,
  googleConfig,
  packStateCookie,
  type GoogleEntryPage,
} from "@/lib/oauth/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/google/start
 *
 * Body: { locale?: "fa" | "en", returnTo?: string, entry?: "login" | "signup" }
 * Answers { ok: true, url } — the Google consent screen the browser should open.
 *
 * The browser POSTs (instead of navigating to a GET) so the double-submit CSRF
 * token can be checked exactly like /api/auth/login does; the response also
 * plants the 10-minute HttpOnly cookie holding the PKCE verifier and the state
 * nonce that the callback validates.
 */
export async function POST(req: NextRequest) {
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  const config = googleConfig();
  if (!config) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "google_not_configured" }, withNoStore({ status: 503 })),
    );
  }

  const body = (await req.json().catch(() => null)) as {
    locale?: string;
    returnTo?: string;
    entry?: string;
    /** Signup form only: "artist" asks for a seller account + pending profile. */
    role?: string;
  } | null;

  const locale: Locale = body?.locale === "en" ? "en" : "fa";
  const entry: GoogleEntryPage = body?.entry === "signup" ? "signup" : "login";
  const wantsArtist = body?.role === "artist";
  const requested = body?.returnTo ? sanitizePlainText(body.returnTo).slice(0, 300) : undefined;
  // A seller signup lands on the artist dashboard unless the visitor asked for
  // somewhere specific.
  const returnTo = requested ?? (entry === "signup" && wantsArtist ? `/${locale}/artist` : undefined);

  const { state, payload } = await createSignedState(locale, {
    returnTo,
    entry,
    wantsArtist,
  });
  const pkce = createPkcePair();
  const redirectUri = googleCallbackUrl(req, config);

  const url = buildAuthorizeUrl(config, {
    redirectUri,
    state,
    codeChallenge: pkce.challenge,
  });

  const res = NextResponse.json({ ok: true, url }, withNoStore());
  res.cookies.set(GOOGLE_STATE_COOKIE, packStateCookie(payload.n, pkce.verifier), {
    ...sessionCookieOptions(req),
    maxAge: Math.floor(GOOGLE_STATE_TTL_MS / 1000),
  });
  return applySecurityHeaders(req, res);
}
