import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createUser, findUserByEmail, upgradeUserToArtist, type StoredUser } from "@/lib/data/users";
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

  return finishSignIn({
    req,
    email: result.email,
    locale: result.locale,
    entry: result.entry,
    role: result.role,
    returnTo: result.returnTo,
  });
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

  const resolved = account
    ? await maybeUpgradeToArtist(account, verified)
    : { user: await createUser(nameFromEmail(email), email, randomPassword(), verified.role), created: true, upgraded: false };

  const session = await sessionUserFromStored(resolved.user);
  const isArtist = session.role === "artist" || Boolean(session.artistId);

  const res = NextResponse.json(
    {
      ok: true,
      user: session,
      created: resolved.created,
      upgraded: resolved.upgraded,
      // Server-validated target: the page navigates to exactly this path.
      returnTo: safeReturnPath(body?.returnTo, locale, isArtist ? `/${locale}/artist` : undefined),
    },
    withNoStore(),
  );
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions(req));
  return applySecurityHeaders(req, res);
}

/* ------------------------------------------------------------------ */

interface SignInInput {
  req: NextRequest;
  email: string;
  locale: "fa" | "en";
  entry: "login" | "signup";
  role: "user" | "artist";
  returnTo: string;
}

/**
 * The role a signup code may apply. A code requested from the *login* form can
 * never change an account: only the signup form, where the visitor explicitly
 * picked "هنرمند / طراح", asks for a seller profile.
 */
async function maybeUpgradeToArtist(
  account: StoredUser,
  verified: { role: "user" | "artist"; entry: "login" | "signup" },
): Promise<{ user: StoredUser; created: boolean; upgraded: boolean }> {
  const wantsSeller = verified.entry === "signup" && verified.role === "artist";
  if (!wantsSeller || account.role !== "user") {
    return { user: account, created: false, upgraded: false };
  }

  const upgradedUser = await upgradeUserToArtist(account.id);
  if (!upgradedUser) return { user: account, created: false, upgraded: false };

  if (upgradedUser.createdProfile) {
    void sendAdminPushSafely({
      title: "درخواست فروشندگی جدید",
      body: "یک کاربر با کد ایمیلی حساب خود را به هنرمند/فروشنده ارتقا داد؛ در انتظار بررسی.",
      url: "/admin/fa?section=artists-signup",
      tag: `artist-upgrade-email-${upgradedUser.user.id}`,
    });
  }

  return { user: upgradedUser.user, created: false, upgraded: upgradedUser.createdProfile };
}

/** Shared tail of both verification paths: issue the session cookie. */
async function finishSignIn({ req, email, locale, entry, role, returnTo }: SignInInput): Promise<NextResponse> {
  const account = await findUserByEmail(email);

  if (!account && !emailLoginSignupAllowed()) {
    const res = NextResponse.redirect(formUrl(req, locale, entry, "email_no_account"));
    res.headers.set("cache-control", "private, no-store");
    return res;
  }

  let stored = account;
  let created = false;
  let upgraded = false;

  if (!stored) {
    try {
      stored = await createUser(nameFromEmail(email), email, randomPassword(), role);
      created = true;
    } catch {
      stored = await findUserByEmail(email);
      if (!stored) {
        const res = NextResponse.redirect(formUrl(req, locale, entry, "email_failed"));
        res.headers.set("cache-control", "private, no-store");
        return res;
      }
    }
  } else {
    const resolved = await maybeUpgradeToArtist(stored, { role, entry });
    stored = resolved.user;
    upgraded = resolved.upgraded;
  }

  if (created || upgraded) {
    void sendAdminPushSafely({
      title: role === "artist" ? "ثبت‌نام طراح جدید" : "عضو جدید سایت",
      body:
        role === "artist"
          ? "یک کاربر با کد ایمیلی ثبت‌نام هنرمند/فروشنده را انجام داد؛ برای بررسی درخواست وارد پنل شوید."
          : "یک کاربر با کد ایمیلی در سایت ثبت‌نام کرد.",
      url: role === "artist" ? "/admin/fa?section=artists-signup" : "/admin/fa?section=buyers",
      tag: `signup-email-${stored.id}`,
    });
  }

  const session = await sessionUserFromStored(stored);
  const isArtist = session.role === "artist" || Boolean(session.artistId);
  const target = safeReturnPath(returnTo, locale, isArtist ? `/${locale}/artist` : undefined);

  const res = NextResponse.redirect(new URL(target, appOrigin(req)));
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
