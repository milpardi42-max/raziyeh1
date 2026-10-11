import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createUser, toPublicUser, upgradeUserToArtist } from "@/lib/data/users";
import { sendAdminPushSafely } from "@/lib/admin-push";
import { createSessionToken, getSession, publicUserToSession, sessionUserFromStored, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { clientIp, recordAttempt, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import { sanitizePlainText } from "@/lib/security/sanitize";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    phone?: string;
    city?: string;
    specialty?: string;
    instagram?: string;
    portfolioUrl?: string;
    planId?: "starter" | "pro" | "studio";
    bio?: string;
  } | null;

  if (!body?.name || !body?.email || !body?.password) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 })),
    );
  }
  if (body.password.length < 6) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "password_too_short" }, withNoStore({ status: 400 })),
    );
  }

  const name = sanitizePlainText(body.name).slice(0, 120);
  const email = sanitizePlainText(body.email).trim().toLowerCase().slice(0, 254);
  const phone = body.phone ? sanitizePlainText(body.phone).slice(0, 32) : undefined;
  const city = body.city ? sanitizePlainText(body.city).slice(0, 80) : undefined;
  const specialty = body.specialty ? sanitizePlainText(body.specialty).slice(0, 120) : undefined;
  const instagram = body.instagram ? sanitizePlainText(body.instagram).slice(0, 64) : undefined;
  const portfolioUrl = body.portfolioUrl ? sanitizePlainText(body.portfolioUrl).slice(0, 500) : undefined;
  const bio = body.bio ? sanitizePlainText(body.bio).slice(0, 2000) : undefined;
  const password = body.password.slice(0, 256);

  const key = `signup:${clientIp(req)}`;
  if (tooManyAttempts(key)) {
    const retryAfter = retryAfterSeconds(key);
    const res = NextResponse.json(
      { ok: false, error: "too_many_attempts" },
      withNoStore({ status: 429, headers: retryAfter > 0 ? { "retry-after": String(retryAfter) } : undefined }),
    );
    return applySecurityHeaders(req, res);
  }
  recordAttempt(key);

  const role = body.role === "artist" ? "artist" : "user";

  const extra = role === "artist"
    ? { phone, city, specialty, instagram, portfolioUrl, planId: body.planId || "pro" as const, bio, termsAt: new Date().toISOString() }
    : undefined;

  /*
   * Already signed in? A buyer who fills the seller form (or the shared signup
   * form with "هنرمند / طراح" selected) is upgrading their own account — not
   * creating a second one. Without this branch the request would fail with
   * `email_taken` and the visitor would be stuck forever as a buyer, which is
   * exactly what happened to accounts created with Google or an e-mail code.
   */
  if (role === "artist") {
    const current = await getSession();
    if (current && current.email.toLowerCase() === email && current.role === "user") {
      const upgraded = await upgradeUserToArtist(current.id, extra);
      if (upgraded) {
        const upgradedSession = await sessionUserFromStored(upgraded.user);
        const res = NextResponse.json(
          { ok: true, user: upgradedSession, upgraded: upgraded.createdProfile },
          withNoStore(),
        );
        res.cookies.set(SESSION_COOKIE, await createSessionToken(upgradedSession), sessionCookieOptions(req));
        if (upgraded.createdProfile) {
          await sendAdminPushSafely({
            title: "درخواست فروشندگی جدید",
            body: "یک خریدار حساب خود را به هنرمند/فروشنده ارتقا داد؛ برای بررسی درخواست وارد پنل شوید.",
            url: "/admin/fa?section=artists-signup",
            tag: `artist-upgrade-${upgraded.user.id}`,
          });
        }
        return applySecurityHeaders(req, res);
      }
    }
  }

  try {
    const stored = await createUser(name, email, password, role, undefined, extra);
    const pub = toPublicUser(stored);
    const session = publicUserToSession(pub);
    const res = NextResponse.json({ ok: true, user: session }, withNoStore());
    res.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions(req));

    await sendAdminPushSafely({
      title: role === "artist" ? "ثبت‌نام طراح جدید" : "عضو جدید سایت",
      body: role === "artist"
        ? "یک طراح برای عضویت ثبت‌نام کرد؛ برای بررسی درخواست وارد پنل شوید."
        : "یک خریدار جدید در سایت عضو شد.",
      url: role === "artist" ? "/admin/fa?section=artists-signup" : "/admin/fa?section=buyers",
      tag: `signup-${stored.id}`,
    });

    return applySecurityHeaders(req, res);
  } catch (e) {
    if (e instanceof Error && e.message === "email_taken") {
      return applySecurityHeaders(
        req,
        NextResponse.json({ ok: false, error: "email_taken" }, withNoStore({ status: 409 })),
      );
    }
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "server_error" }, withNoStore({ status: 500 })),
    );
  }
}
