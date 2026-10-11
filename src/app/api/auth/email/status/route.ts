import { NextResponse } from "next/server";
import { withNoStore } from "@/lib/http";
import { emailLoginEnabled, emailTestModeAddresses, emailTestModeEnabled } from "@/lib/auth/email-login-mode";
import { mailProvider } from "@/lib/marketplace/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/email/status
 *
 * Tells the browser whether e-mail sign-in can really be used:
 *
 *   provider "resend"/"smtp"            → real delivery, the code arrives by e-mail
 *   provider "outbox", development      → test mode: the code is shown on the page
 *   provider "outbox", production       → only with EMAIL_LOGIN_TEST_MODE (staging);
 *                                        otherwise reported as unavailable so the
 *                                        visitor is never promised a message that
 *                                        could not arrive
 */
export async function GET() {
  const provider = mailProvider();
  const realDelivery = provider !== "outbox";
  const enabled = emailLoginEnabled();
  const testMode = !realDelivery && emailTestModeEnabled();
  const available = enabled && (realDelivery || process.env.NODE_ENV !== "production" || testMode);

  return NextResponse.json(
    {
      ok: true,
      available,
      enabled,
      provider,
      realDelivery,
      testMode: !realDelivery,
      testEmails: testMode ? emailTestModeAddresses() : [],
      error: available
        ? null
        : !enabled
          ? "email_login_disabled"
          : "email_not_configured",
    },
    withNoStore(),
  );
}

