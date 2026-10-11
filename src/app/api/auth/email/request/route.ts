import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withNoStore } from "@/lib/http";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { clientIp, recordAttempt, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";
import { findUserByEmail } from "@/lib/data/users";
import { appOrigin } from "@/lib/request-origin";
import { createLoginCode } from "@/lib/auth/email-code";
import { sendLoginMail } from "@/lib/auth/login-mail";
import { emailLoginEnabled, emailLoginSignupAllowed } from "@/lib/auth/email-login-mode";
import { mailProvider } from "@/lib/marketplace/config";
import type { NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/email/request
 *
 * Body: { email, locale?, entry?: "login" | "signup", returnTo? }
 * Creates a 6-digit code + a one-click link for that address and mails them.
 *
 * Answers `{ ok: true, sent: true, expiresInS, delivered, devCode? }`.
 * `devCode` is only included when the build is not a production build AND no
 * mail provider is connected (outbox mode): it lets the whole flow be tested
 * before Resend/SMTP credentials exist, and can never leak a live code.
 */
export async function POST(req: NextRequest) {
  // Same double-submit CSRF gate as /api/auth/login.
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    locale?: string;
    entry?: string;
    returnTo?: string;
  } | null;

  const email = sanitizePlainText(body?.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "invalid_email" }, withNoStore({ status: 400 })),
    );
  }

  if (!emailLoginEnabled()) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "email_login_disabled" }, withNoStore({ status: 503 })),
    );
  }

  const locale: Locale = body?.locale === "en" ? "en" : "fa";
  const entry = body?.entry === "signup" ? "signup" : "login";

  // Throttle per address and per IP: every code costs one e-mail.
  const emailKey = `email-otp:${email}`;
  const ipKey = `email-otp-ip:${clientIp(req)}`;
  const throttled = [emailKey, ipKey].find((key) => tooManyAttempts(key));
  if (throttled) {
    const retryAfter = retryAfterSeconds(throttled);
    return applySecurityHeaders(
      req,
      NextResponse.json(
        { ok: false, error: "too_many_attempts" },
        withNoStore({ status: 429, headers: retryAfter > 0 ? { "retry-after": String(retryAfter) } : undefined }),
      ),
    );
  }
  recordAttempt(emailKey);
  recordAttempt(ipKey);

  const account = await findUserByEmail(email);
  const isNewAccount = account === null;

  // The login form only signs existing accounts in; the signup form may create one.
  if (isNewAccount && (entry === "login" || !emailLoginSignupAllowed())) {
    return applySecurityHeaders(
      req,
      NextResponse.json(
        { ok: false, error: entry === "login" ? "email_no_account" : "email_signup_disabled" },
        withNoStore({ status: 200 }),
      ),
    );
  }

  const created = await createLoginCode({
    email,
    locale,
    entry,
    returnTo: sanitizePlainText(body?.returnTo ?? "").slice(0, 300),
  });

  if (!created.ok) {
    return applySecurityHeaders(
      req,
      NextResponse.json(
        { ok: false, error: "cooldown", retryAfterS: created.retryAfterS },
        withNoStore({ status: 429, headers: { "retry-after": String(created.retryAfterS) } }),
      ),
    );
  }

  const link = `${appOrigin(req)}/api/auth/email/verify?token=${encodeURIComponent(created.token)}`;
  const delivery = await sendLoginMail({ email, code: created.code, link, locale, isNewAccount })
    .catch(() => null);

  const devMode = process.env.NODE_ENV !== "production" && mailProvider() === "outbox";

  return applySecurityHeaders(
    req,
    NextResponse.json(
      {
        ok: true,
        sent: true,
        isNewAccount,
        expiresInS: Math.round((new Date(created.expiresAt).getTime() - Date.now()) / 1000),
        delivered: delivery?.status ?? "failed",
        ...(devMode ? { devCode: created.code, devLink: link } : {}),
      },
      withNoStore(),
    ),
  );
}
