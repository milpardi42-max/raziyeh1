import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN_DISABLED } from "@/lib/admin-access";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/types";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";
import { applySecurityHeaders, createContentSecurityPolicy } from "@/lib/security/headers";
import { ensureCsrfToken } from "@/lib/security/csrf";

function isOwnerEmail(email: string): boolean {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return false;
  return email.toLowerCase() === ownerEmail;
}

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = createNonce();

  // Next.js reads the forwarded CSP nonce and attaches it to its streamed RSC and hydration scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", createContentSecurityPolicy(req, nonce));
  let res = NextResponse.next({ request: { headers: requestHeaders } });
  res = applySecurityHeaders(req, res, nonce);
  ensureCsrfToken(req, res);

  /* -------- مسیرهای پنل ادمین (/admin/[locale]/) -------- */
  // این مسیرها از layout سایت جدا هستند
  const adminMatch = pathname.match(/^\/admin\/([^/]+)(\/.*)?$/);
  if (adminMatch) {
    const rest = adminMatch[2] ?? "";

    // TEMPORARY: the owner requested direct public access to the admin panel.
    if (ADMIN_LOGIN_DISABLED) {
      if (rest === "/login" || rest === "/login/") {
        const panelUrl = req.nextUrl.clone();
        panelUrl.pathname = `/admin/${adminMatch[1]}`;
        return applySecurityHeaders(req, NextResponse.redirect(panelUrl), nonce);
      }
      return res;
    }

    // صفحه لاگین ادمین نیازی به بررسی نشست ندارد
    if (rest === "/login" || rest === "/login/") return res;

    // بقیه مسیرهای ادمین نیاز به نقش admin دارند
    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    const session = await readSessionToken(sessionToken);
    if (!session || session.role !== "admin") {
      const locale = adminMatch[1];
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/admin/${locale}/login`;
      loginUrl.search = "";
      loginUrl.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
      return applySecurityHeaders(req, NextResponse.redirect(loginUrl), nonce);
    }
    return res;
  }

  /* -------- i18n locale prefix (برای مسیرهای سایت اصلی) -------- */
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale) {
    const cookie = req.cookies.get("ra-locale")?.value;
    const locale = LOCALES.includes(cookie as never) ? cookie : DEFAULT_LOCALE;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return applySecurityHeaders(req, NextResponse.redirect(url), nonce);
  }

  /* -------- Protected routes (سایت اصلی) -------- */
  const segments = pathname.split("/").filter(Boolean);
  const rest = segments.slice(1).join("/");

  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(sessionToken);

  /*
   * /[locale]/artist — the seller area.
   *
   * Signed-out visitors go to the login page. A signed-in *buyer* is let
   * through on purpose: both /artist and /artist/marketplace explain that the
   * area is for artists and point at the designer registration, which is far
   * friendlier than a login form for an account that cannot open it. The
   * artist APIs keep enforcing the role themselves.
   */
  if (rest === "artist" || rest.startsWith("artist/")) {
    if (!session) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${segments[0]}/login`;
      loginUrl.searchParams.set("next", pathname);
      return applySecurityHeaders(req, NextResponse.redirect(loginUrl), nonce);
    }
  }

  // /[locale]/owner/* — requires owner email or admin role
  if (rest === "owner" || rest.startsWith("owner/")) {
    const isOwnerSession =
      session && (session.role === "admin" || isOwnerEmail(session.email));
    if (!isOwnerSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${segments[0]}/login`;
      loginUrl.searchParams.set("next", pathname);
      return applySecurityHeaders(req, NextResponse.redirect(loginUrl), nonce);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next|fonts|images|favicon.ico|.*\\..*).*)"],
};
