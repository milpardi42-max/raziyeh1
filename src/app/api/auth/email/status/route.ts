import { NextResponse } from "next/server";
import { withNoStore } from "@/lib/http";
import { emailLoginEnabled } from "@/lib/auth/email-login-mode";
import { mailProvider } from "@/lib/marketplace/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/email/status
 *
 * Tells the browser whether e-mail sign-in can really deliver a message:
 *
 *   provider "resend"/"smtp" → real delivery, the code arrives by e-mail
 *   provider "outbox"        → development: the code is shown on the page
 *   provider "outbox" in production → nothing would arrive, so the option is
 *                              reported as unavailable instead of pretending.
 */
export async function GET() {
  const provider = mailProvider();
  const realDelivery = provider !== "outbox";
  const enabled = emailLoginEnabled();
  const available = enabled && (realDelivery || process.env.NODE_ENV !== "production");

  return NextResponse.json(
    {
      ok: true,
      available,
      enabled,
      provider,
      realDelivery,
      error: available
        ? null
        : !enabled
          ? "email_login_disabled"
          : "email_not_configured",
    },
    withNoStore(),
  );
}
