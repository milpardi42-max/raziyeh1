import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createUser, findUserByEmail } from "@/lib/data/users";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, sessionUserFromStored } from "@/lib/auth";
import { sendAdminPushSafely } from "@/lib/admin-push";
import { withNoStore } from "@/lib/http";
import { appOrigin } from "@/lib/request-origin";
import { safeReturnPath } from "@/lib/auth/return-path";
import { verifyLoginCode, verifyLoginToken } from "@/lib/auth/email-code";
import { emailLoginEnabled, emailLoginSignupAllowed } from "@/lib/auth/email-login-mode";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { clientIp, recordAttempt, tooManyAttempts } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Google-style locale redirect target when a link cannot be used. */
function formUrl(req: NextRequest, locale: "fa" | "en", entry: "login" | "signup", error: string): URL {
  const url = new URL(`/${locale}/${entry}`, appOrigin(req));
  url.searchParams.set("email_error", error);
  return url;
}

/**
 * GET /api/auth/email/verify?token=…
 *
 * The one-click path from the e-mail. A browser following a link cannot send the
 * CSRF header, so the token itself is the credential — it is 32 random bytes,
 * stored only as an HMAC, single-use and short-lived.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await verifyLoginToken(token);

  if (!result.ok) {
    const locale = req.nextUrl.searchParams.get("l") === "en" ? "en" : "fa";
    const res = NextResponse.redirect(formUrl(req, locale, "login", `email_${result.error}`));
    res.headers.set("cache-control", "private, no-store");
    return res;
  }

  return finishSignIn(req, result.email, result.locale, result.entry, result.returnTo);
}

/**
 * POST /api/auth/email/verify — the typed-code path.
 * Body: { email, code, returnTo? }
 */
export async function POST(req: NextRequest) {
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  if (!emailLoginEnabled()) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "email_login_disabled" }, withNoStore({ status: 503 })),
    );
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    code?: string;
    locale?: string;
    returnTo?: string;
  } | null;

  const email = sanitizePlainText(body?.email ?? "").trim().toLowerCase();
  const code = sanitizePlainText(body?.code ?? "").replace(/\D/g, "").slice(0, 6);
  if (!email || code.length !== 6) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "invalid_code" }, withNoStore({ status: 400 })),
    );
  }

  const ipKey = `email-otp-verify:${clientIp(req)}`;
  if (tooManyAttempts(ipKey)) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "too_many_attempts" }, withNoStore({ status: 429 })),
    );
  }
  recordAttempt(ipKey);

  const locale = body?.locale === "en" ? "en" : "fa";
  const verified = await verifyLoginCode(email, code);
  if (!verified.ok) {
    return applySecurityHeaders(
      req,
      NextResponse.json(
        { ok: false, error: verified.error === "expired" ? "code_expired" : verified.error === "too_many_attempts" ? "too_many_attempts" : "invalid_code" },
        withNoStore({ status: verified.error === "too_many_attempts" ? 429 : 400 }),
      ),
    );
  }

  const account = await findUserByEmail(email);
  if (!account && !emailLoginSignupAllowed()) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "email_no_account" }, withNoStore({ status: 404 })),
    );
  }

  const stored = account ?? (await createUser(nameFromEmail(email), email, randomPassword(), "user"));
  const session = await sessionUserFromStored(stored);

  const res = NextResponse.json(
    {
      ok: true,
      user: session,
      created: !account,
      // Server-validated target: the page navigates to exactly this path.
      returnTo: safeReturnPath(body?.returnTo, locale),
    },
    withNoStore(),
  );
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions(req));
  return applySecurityHeaders(req, res);
}

/* ------------------------------------------------------------------ */

/** Shared tail of both verification paths: issue the session cookie. */
async function finishSignIn(
  req: NextRequest,
  email: string,
  locale: "fa" | "en",
  entry: "login" | "signup",
  returnTo: string,
): Promise<NextResponse> {
  const account = await findUserByEmail(email);

  if (!account && !emailLoginSignupAllowed()) {
    const res = NextResponse.redirect(formUrl(req, locale, entry, "email_no_account"));
    res.headers.set("cache-control", "private, no-store");
    return res;
  }

  let stored = account;
  let created = false;
  if (!stored) {
    try {
      stored = await createUser(nameFromEmail(email), email, randomPassword(), "user");
      created = true;
    } catch {
      stored = await findUserByEmail(email);
      if (!stored) {
        const res = NextResponse.redirect(formUrl(req, locale, entry, "email_failed"));
        res.headers.set("cache-control", "private, no-store");
        return res;
      }
    }
  }

  if (created) {
    void sendAdminPushSafely({
      title: "عضو جدید سایت",
      body: "یک کاربر با کد ایمیلی در سایت ثبت‌نام کرد.",
      url: "/admin/fa?section=buyers",
      tag: `signup-email-${stored.id}`,
    });
  }

  const session = await sessionUserFromStored(stored);
  const res = NextResponse.redirect(new URL(safeReturnPath(returnTo, locale), appOrigin(req)));
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions(req));
  res.headers.set("cache-control", "private, no-store");
  return res;
}

/** Accounts created from an e-mail code get a display name from the address. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return (local || email.split("@")[0]).slice(0, 80);
}

/**
 * Accounts created through an e-mail code still get a password hash: the value
 * is random and never shown, so the account cannot be entered with an empty or
 * guessed password (it simply has no password login until one is set).
 */
function randomPassword(): string {
  return crypto.randomBytes(32).toString("base64url");
}
