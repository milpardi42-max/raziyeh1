"use client";

import { SESSION_FETCH } from "@/lib/http";

/**
 * True when the session cookie the server has just issued actually round-trips
 * back to us.
 *
 * Inside a cross-site preview iframe some browsers refuse to store third-party
 * cookies at all (even partitioned ones). Signing in then looks successful —
 * the API answers 200 — but the visitor is a stranger again on the next page.
 * Checking `/api/auth/me` turns that silent failure into an honest message.
 *
 * Returns true whenever the answer is unclear, so a flaky network can never
 * block a legitimate sign-in.
 */
export async function sessionCookieWorks(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", { ...SESSION_FETCH });
    if (!res.ok) return true;
    const data = (await res.json()) as { user?: unknown };
    return Boolean(data?.user);
  } catch {
    return true;
  }
}
