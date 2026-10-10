import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, verifyCredentials } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { clientIp, clearFailures, recordFailure, tooManyAttempts } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // CSRF gate
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 })),
    );
  }

  // Basic input sanitization + length caps to blunt credential-stuffing junk
  const email = sanitizePlainText(body.email).trim().toLowerCase().slice(0, 254);
  const password = body.password.slice(0, 256);

  const key = `login:${clientIp(req)}|${email}`;
  if (tooManyAttempts(key)) {
    return applySecurityHeaders(
      req,
      NextResponse.json(
        { ok: false, error: "too_many_attempts" },
        withNoStore({ status: 429, headers: { "retry-after": String(15 * 60) } }),
      ),
    );
  }
  const result = await verifyCredentials(email, password);
  if (!result.ok) {
    recordFailure(key);
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: result.error }, withNoStore({ status: 401 })),
    );
  }
  clearFailures(key);
  const res = NextResponse.json({ ok: true, user: result.user }, withNoStore());
  // Session fixation: always issue a fresh cookie on successful login.
  res.cookies.set(SESSION_COOKIE, await createSessionToken(result.user), sessionCookieOptions(req));
  return applySecurityHeaders(req, res);
}
