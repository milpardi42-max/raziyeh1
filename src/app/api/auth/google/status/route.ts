import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/oauth/google";
import { withNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tells the browser whether the "Continue with Google" button can start a real
 * sign-in yet. Deliberately public and credential-free: it only reports whether
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set on the server, so the button
 * can show the "not configured" notice instead of bouncing the visitor to Google.
 */
export async function GET() {
  const configured = isGoogleConfigured();
  return NextResponse.json(
    { ok: true, configured, error: configured ? null : "google_not_configured" },
    withNoStore(),
  );
}
