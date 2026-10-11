/**
 * Configuration for password-less e-mail sign-in.
 *
 *   EMAIL_LOGIN_ENABLED=0        hides the "sign in with e-mail code" option
 *                                (the API then answers email_login_disabled)
 *   EMAIL_LOGIN_ALLOW_SIGNUP=0   an e-mail code can only sign in accounts that
 *                                already exist; the signup form will not create
 *                                a new one
 *   EMAIL_LOGIN_TTL_MINUTES      code/link lifetime, 2–60 (default 10)
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
