import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, sessionUserFromStored } from "@/lib/auth";
import { findUserById, upgradeUserToArtist, type ArtistSignupExtra } from "@/lib/data/users";
import { sendAdminPushSafely } from "@/lib/admin-push";
import { withNoStore } from "@/lib/http";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { clientIp, recordAttempt, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/artist/upgrade
 *
 * Turns the signed-in **buyer** account into a seller account and creates the
 * linked Artist profile — exactly the same record the seller registration
 * creates (see `createPendingArtist`), so the showcase behaves identically.
 *
 * This is the way out of the old dead end: a visitor who registered with
 * Google, an e-mail code or a password — and therefore already has a buyer
 * account — could not use /creators/join, because creating an account for the
 * same e-mail is refused. The artist role can only ever be *added* to the
 * caller's own account (the session identifies it), never to somebody else's,
 * and an admin or existing artist is returned unchanged.
 *
 * Body (all optional): { phone, city, specialty, instagram, portfolioUrl, bio, planId }
 */
export async function POST(req: NextRequest) {
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  const session = await getSession();
  if (!session) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 })),
    );
  }

  const key = `artist-upgrade:${clientIp(req)}`;
  if (tooManyAttempts(key)) {
    const retryAfter = retryAfterSeconds(key);
    return applySecurityHeaders(
      req,
      NextResponse.json(
        { ok: false, error: "too_many_attempts" },
        withNoStore({ status: 429, headers: retryAfter > 0 ? { "retry-after": String(retryAfter) } : undefined }),
      ),
    );
  }
  recordAttempt(key);

  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    city?: string;
    specialty?: string;
    instagram?: string;
    portfolioUrl?: string;
    bio?: string;
    planId?: "starter" | "pro" | "studio";
  } | null;

  const extra: ArtistSignupExtra = {
    phone: body?.phone ? sanitizePlainText(body.phone).slice(0, 32) : undefined,
    city: body?.city ? sanitizePlainText(body.city).slice(0, 80) : undefined,
    specialty: body?.specialty ? sanitizePlainText(body.specialty).slice(0, 120) : undefined,
    instagram: body?.instagram ? sanitizePlainText(body.instagram).slice(0, 64) : undefined,
    portfolioUrl: body?.portfolioUrl ? sanitizePlainText(body.portfolioUrl).slice(0, 500) : undefined,
    bio: body?.bio ? sanitizePlainText(body.bio).slice(0, 2000) : undefined,
    planId: body?.planId === "starter" || body?.planId === "studio" ? body.planId : "pro",
    termsAt: new Date().toISOString(),
  };

  // `session.id` for an env-configured admin is the literal "admin" — such a
  // caller has no user record, so the upgrade is a no-op for them.
  const account = session.id === "admin" ? null : await findUserById(session.id);
  if (!account) {
    return applySecurityHeaders(
      req,
      NextResponse.json(
        { ok: true, alreadyArtist: session.role === "artist" || session.role === "admin", user: session },
        withNoStore(),
      ),
    );
  }

  const result = await upgradeUserToArtist(account.id, extra);
  if (!result) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "server_error" }, withNoStore({ status: 500 })),
    );
  }

  if (result.createdProfile) {
    void sendAdminPushSafely({
      title: "درخواست فروشندگی جدید",
      body: "یک کاربر حساب خریدار خود را به هنرمند/فروشنده ارتقا داد؛ برای بررسی درخواست وارد پنل شوید.",
      url: "/admin/fa?section=artists-signup",
      tag: `artist-upgrade-${result.user.id}`,
    });
  }

  const nextSession = await sessionUserFromStored(result.user);
  const res = NextResponse.json(
    { ok: true, user: nextSession, upgraded: result.createdProfile, alreadyArtist: !result.createdProfile },
    withNoStore(),
  );
  // Refresh the cookie so the seller area is reachable without a re-login.
  res.cookies.set(SESSION_COOKIE, await createSessionToken(nextSession), sessionCookieOptions(req));
  return applySecurityHeaders(req, res);
}
