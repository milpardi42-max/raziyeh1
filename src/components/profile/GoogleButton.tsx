"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withCsrf } from "@/lib/security/csrf-client";
import { SESSION_FETCH } from "@/lib/http";
import type { Locale } from "@/lib/i18n/types";

/** The official Google "G" — four flat paths, no gradients, brand colours. */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className="auth-oauth__logo"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface GoogleButtonProps {
  locale: Locale;
  /** Page the visitor is on — a failed round-trip returns to the same form. */
  entry: "login" | "signup";
  /**
   * Role chosen on the signup form. Passed to the server so a brand-new Google
   * account is created as a seller when "هنرمند / طراح" is selected; ignored
   * (and never applied to an existing account) for the login entry.
   */
  role?: "user" | "artist";
  /** Same-origin path to open after a successful sign-in. */
  returnTo?: string;
  /** True while the e-mail/password form is submitting. */
  disabled?: boolean;
  /**
   * Runs before the flow starts. Returning false aborts the click so the form
   * can handle it (e.g. signup without the terms checkbox ticked).
   */
  beforeStart?: () => boolean;
  /** Receives a code from AuthForm's ERROR_MESSAGES dictionary. */
  onError: (code: string) => void;
}

/**
 * "Continue with Google" — the button is fully wired: it asks
 * /api/auth/google/status whether the server has OAuth credentials, and on click
 * starts the real flow through /api/auth/google/start. Until the credentials are
 * configured it reports `google_not_configured` instead of bouncing the visitor
 * to Google, so the form stays usable.
 */
export function GoogleButton({ locale, entry, role, returnTo, disabled, beforeStart, onError }: GoogleButtonProps) {
  const fa = locale === "fa";
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    fetch("/api/auth/google/status", { ...SESSION_FETCH })
      .then((r) => (r.ok ? (r.json() as Promise<{ configured?: boolean }>) : Promise.reject()))
      .then((d) => {
        if (aliveRef.current) setConfigured(d.configured === true);
      })
      .catch(() => {
        // Endpoint unreachable — leave the state unknown and let the click decide.
        if (aliveRef.current) setConfigured(null);
      });
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const start = useCallback(async () => {
    if (disabled || connecting) return;
    if (beforeStart && !beforeStart()) return;

    if (configured === false) {
      onError("google_not_configured");
      return;
    }

    setConnecting(true);
    try {
      const res = await fetch("/api/auth/google/start", withCsrf({
        ...SESSION_FETCH,
        method: "POST",
        headers: { "content-type": "application/json" },
        // The server only honours `role` for the signup entry.
        body: JSON.stringify({ locale, entry, role, returnTo }),
      }));
      const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;

      if (res.ok && data?.ok && data.url) {
        // Full-page navigation to Google's consent screen.
        window.location.assign(data.url);
        return;
      }
      setConnecting(false);
      setConfigured(data?.error === "google_not_configured" ? false : configured);
      onError(data?.error === "google_not_configured" ? "google_not_configured" : "network");
    } catch {
      setConnecting(false);
      onError("network");
    }
  }, [beforeStart, configured, connecting, disabled, entry, locale, onError, returnTo, role]);

  const label = connecting
    ? fa
      ? "در حال اتصال به گوگل…"
      : "Connecting to Google…"
    : fa
      ? "ادامه با گوگل"
      : "Continue with Google";

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || connecting}
      aria-busy={connecting}
      data-state={connecting ? "connecting" : "idle"}
      className="auth-oauth"
    >
      <span className="auth-oauth__mark" aria-hidden="true">
        <GoogleMark />
      </span>
      <span className="auth-oauth__label" aria-live="polite">
        {label}
      </span>
      {connecting && <span className="auth-oauth__spinner" aria-hidden="true" />}
    </button>
  );
}
