import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import type { NextRequest } from "next/server";

/** A cached "logged out" response would keep the user signed out; a cached 200 would log them out. */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }
  const res = NextResponse.json({ ok: true }, withNoStore());
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(req), maxAge: 0 });
  return applySecurityHeaders(req, res);
}
