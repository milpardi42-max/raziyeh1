import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { getContentWithEtag, resetContent, saveContent } from "@/lib/data/store";
import { sanitizeDeep } from "@/lib/security/sanitize";
import { verifyCsrf } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import type { SiteContent } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Maximum payload size for admin content writes — 5 MB is plenty for a JSON content tree. */
const MAX_BYTES = 5 * 1024 * 1024;

async function requireAdmin() {
  const user = await getAdminSession();
  return user?.role === "admin" ? user : null;
}

function unauthorized() {
  // No access to a real NextRequest here; use a minimal placeholder just to
  // look up hostname. The CSP/headers are not sensitive to which host emitted 401.
  const placeholder = {
    nextUrl: new URL("http://localhost/"),
    headers: new Headers(),
  } as unknown as NextRequest;
  return applySecurityHeaders(
    placeholder,
    NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 })),
  );
}

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  const [content, etag] = await getContentWithEtag();
  const res = NextResponse.json(content, withNoStore());
  if (etag) res.headers.set("ETag", `"${etag}"`);
  return res;
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  // CSRF check on state change
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 })),
    );
  }

  // Reject overly large bodies before parsing
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "payload_too_large" }, withNoStore({ status: 413 })),
    );
  }

  const body = (await req.json().catch(() => null)) as SiteContent | null;
  if (!body || !Array.isArray(body.patterns) || !Array.isArray(body.products)) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 })),
    );
  }

  // Defense-in-depth sanitization — strip scripts/event handlers/JS URLs from every string field.
  const safeBody = sanitizeDeep(body) as SiteContent;

  const ifMatch = req.headers.get("If-Match");
  const expectedEtag = ifMatch ? ifMatch.replace(/^"|"$/g, "") : undefined;

  try {
    await saveContent(safeBody, expectedEtag);
  } catch (e) {
    if (e instanceof Error && e.message === "etag_conflict") {
      return applySecurityHeaders(
        req,
        NextResponse.json({ ok: false, error: "etag_conflict" }, withNoStore({ status: 409 })),
      );
    }
    console.error("[admin/content] storage write failed:", e);
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "storage_write_failed" }, withNoStore({ status: 502 })),
    );
  }
  return applySecurityHeaders(req, NextResponse.json({ ok: true }, withNoStore()));
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();
  const csrf = verifyCsrf(req, await cookies());
  if (!csrf.ok) {
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 })),
    );
  }
  try {
    await resetContent();
  } catch (e) {
    console.error("[admin/content] storage reset failed:", e);
    return applySecurityHeaders(
      req,
      NextResponse.json({ ok: false, error: "storage_reset_failed" }, withNoStore({ status: 502 })),
    );
  }
  return applySecurityHeaders(req, NextResponse.json({ ok: true }, withNoStore()));
}
