import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/data/users";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, sessionUserFromStored } from "@/lib/auth";
import { sendAdminPushSafely } from "@/lib/admin-push";
import type { NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n/types";
import {
  GOOGLE_STATE_COOKIE,
  appOrigin,
  exchangeCodeForIdToken,
  googleCallbackUrl,
  googleConfig,
  readIdentity,
  unpackStateCookie,
  verifySignedState,
} from "@/lib/oauth/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/google/callback
 *
 * Google sends the visitor back here with `code` + `state`. Every failure is a
 * redirect to the page the flow started from (`/fa/login` or `/fa/signup`) with
 * `?google_error=<code>`; the form turns that code into a localised message.
 * On success the visitor gets the ordinary session cookie and lands on the
 * page they originally wanted.
 */
export async function GET(req: NextRequest) {
  const config = googleConfig();
  const params = req.nextUrl.searchParams;

  const payload = await verifySignedState(params.get("state"));
  const cookie = unpackStateCookie(req.cookies.get(GOOGLE_STATE_COOKIE)?.value);

  const locale: Locale = payload?.l ?? "fa";
  const entry = payload?.e ?? "login";

  /** Bail out to the form with a reason the UI can translate. */
  const fail = (errorCode: string) => {
    const target = new URL(`/${locale}/${entry}`, appOrigin(req));
    target.searchParams.set("google_error", errorCode);
    const res = NextResponse.redirect(target);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { ...sessionCookieOptions(req), maxAge: 0 });
    return res;
  };

  const clearState = (res: NextResponse) => {
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { ...sessionCookieOptions(req), maxAge: 0 });
    return res;
  };

  if (!config) return fail("google_not_configured");

  // The state is HMAC-signed and must also match the nonce planted in the cookie.
  if (!payload || !cookie || cookie.n !== payload.n) return fail("google_state");

  if (params.get("error") === "access_denied") return fail("google_cancelled");
  const code = params.get("code");
  if (!code) return fail("google_failed");

  const redirectUri = googleCallbackUrl(req, config);
  const exchange = await exchangeCodeForIdToken(config, {
    code,
    codeVerifier: cookie.v,
    redirectUri,
  });
  if (!exchange.ok) return fail("google_failed");

  const identity = readIdentity(exchange.idToken, config.clientId);
  if (!identity) return fail("google_failed");
  if (!identity.emailVerified) return fail("google_email_unverified");

  // ----- existing account, or a brand-new one -----------------------------
  let stored = await findUserByEmail(identity.email);
  let created = false;

  if (!stored) {
    if (!config.allowSignup) return fail("google_no_account");
    try {
      // Google accounts have no password: store a random one so the record keeps
      // the same shape (and the account can never be entered with a blank password).
      stored = await createUser(
        identity.name,
        identity.email,
        crypto.randomBytes(32).toString("base64url"),
        "user",
      );
      created = true;
    } catch {
      // Someone registered the same address in the meantime — use that record.
      stored = await findUserByEmail(identity.email);
      if (!stored) return fail("google_failed");
    }
  }

  if (created) {
    void sendAdminPushSafely({
      title: "عضو جدید سایت",
      body: "یک کاربر با حساب گوگل در سایت ثبت‌نام کرد.",
      url: "/admin/fa?section=buyers",
      tag: `signup-google-${stored.id}`,
    });
  }

  const session = await sessionUserFromStored(stored);
  const res = NextResponse.redirect(new URL(payload.r, appOrigin(req)));
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions(req));
  // A proxy must never replay a signed-in redirect: keep the response private.
  res.headers.set("cache-control", "private, no-store");
  return clearState(res);
}
