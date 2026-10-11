/**
 * Configuration for password-less e-mail sign-in.
 *
 *   EMAIL_LOGIN_ENABLED=0        hides the "sign in with e-mail code" option
 *                                (the API then answers email_login_disabled)
 *   EMAIL_LOGIN_ALLOW_SIGNUP=0   an e-mail code can only sign in accounts that
 *                                already exist; the signup form will not create
 *                                a new one
 *   EMAIL_LOGIN_TTL_MINUTES      code/link lifetime, 2–60 (default 10)
 *
 *   EMAIL_LOGIN_TEST_MODE=1      keep the "code shown on the page" behaviour even
 *                                in a production build (no mail provider needed)
 *   EMAIL_LOGIN_TEST_EMAILS=a@b,c@d
 *                                restrict that test mode to these addresses only
 *
 * ⚠️ Test mode bypasses e-mail verification: whoever can see the page can sign in
 * as any address it applies to. Use it on a staging/demo site, or together with
 * EMAIL_LOGIN_TEST_EMAILS, and turn it off before opening the site to the public.
 */

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = raw.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(value)) return false;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  return fallback;
}

export function emailLoginEnabled(): boolean {
  return flag("EMAIL_LOGIN_ENABLED", true);
}

export function emailLoginSignupAllowed(): boolean {
  return emailLoginEnabled() && flag("EMAIL_LOGIN_ALLOW_SIGNUP", true);
}

/** Addresses the test mode is limited to (empty = no restriction configured). */
export function emailTestModeAddresses(): string[] {
  return (process.env.EMAIL_LOGIN_TEST_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function emailTestModeEnabled(): boolean {
  return flag("EMAIL_LOGIN_TEST_MODE", false);
}

/**
 * Should this address be handled in test mode (code returned to the page)?
 *
 * - outside production the outbox path already does this automatically;
 * - in production it needs EMAIL_LOGIN_TEST_MODE=1;
 * - when EMAIL_LOGIN_TEST_EMAILS lists addresses, only those may use it.
 */
export function emailTestModeAppliesTo(email: string): boolean {
  if (!emailTestModeEnabled()) return false;
  const allowed = emailTestModeAddresses();
  if (allowed.length === 0) return true;
  return allowed.includes(email.trim().toLowerCase());
}

