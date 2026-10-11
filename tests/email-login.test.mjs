import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("password-less e-mail code is stored hashed, never in clear", () => {
  const store = read("src/lib/auth/email-code.ts");
  assert.match(store, /signPayload\(`\$\{kind\}:\$\{email\}:\$\{value\}`\)/);
  assert.match(store, /codeHash: string/);
  assert.match(store, /tokenHash: string/);
  assert.match(store, /timingSafeEqual/);
  // the record type must not carry the clear-text values
  assert.doesNotMatch(store, /^\s+code: string;/m);
});

test("code lifetime, attempt cap and resend cooldown are enforced", () => {
  const store = read("src/lib/auth/email-code.ts");
  assert.match(store, /LOGIN_CODE_MAX_ATTEMPTS = 5/);
  assert.match(store, /LOGIN_CODE_RESEND_COOLDOWN_MS = 60_000/);
  assert.match(store, /EMAIL_LOGIN_TTL_MINUTES/);
  assert.match(store, /record\.attempts >= LOGIN_CODE_MAX_ATTEMPTS/);
  // a consumed record can never be replayed
  assert.match(store, /if \(!record \|\| record\.consumedAt\) return \{ ok: false, error: "not_found" \}/);
});

test("request endpoint is CSRF-protected and rate limited", () => {
  const route = read("src/app/api/auth/email/request/route.ts");
  assert.match(route, /verifyCsrf\(req, await cookies\(\)\)/);
  assert.match(route, /email-otp:/);
  assert.match(route, /email-otp-ip:/);
  assert.match(route, /tooManyAttempts/);
});

test("the dev code is only exposed outside production and without a mail provider", () => {
  const route = read("src/app/api/auth/email/request/route.ts");
  assert.match(route, /process\.env\.NODE_ENV !== "production" && mailProvider\(\) === "outbox"/);
  assert.match(route, /\.\.\.\(devMode \? \{ devCode: created\.code, devLink: link \} : \{\}\)/);
});

test("both verification paths issue the standard session cookie", () => {
  const route = read("src/app/api/auth/email/verify/route.ts");
  assert.match(route, /SESSION_COOKIE, await createSessionToken\(session\), sessionCookieOptions\(req\)/);
  assert.match(route, /verifyLoginToken\(token\)/);
  assert.match(route, /verifyLoginCode\(email, code\)/);
  // the magic-link redirect target is validated
  assert.match(route, /safeReturnPath\(returnTo, locale\)/);
});

test("user interfaces offer the e-mail code option and the test-mode notice", () => {
  const form = read("src/components/profile/AuthForm.tsx");
  const code = read("src/components/profile/EmailCodeForm.tsx");
  assert.match(form, /<EmailCodeForm/);
  assert.match(form, /auth-alt-method/);
  assert.match(form, /email_error/);
  assert.match(code, /\/api\/auth\/email\/request/);
  assert.match(code, /\/api\/auth\/email\/verify/);
  assert.match(code, /auth-code__dev/);
  assert.match(code, /autoComplete="one-time-code"/);
});

test("sign-up by e-mail code requires the terms checkbox", () => {
  const code = read("src/components/profile/EmailCodeForm.tsx");
  assert.match(code, /entry === "signup" && !termsAccepted/);
  assert.match(code, /<TermsModal/);
});

test("e-mail login configuration flags exist and are documented", () => {
  const mode = read("src/lib/auth/email-login-mode.ts");
  assert.match(mode, /EMAIL_LOGIN_ENABLED/);
  assert.match(mode, /EMAIL_LOGIN_ALLOW_SIGNUP/);
  const env = read(".env.example");
  assert.match(env, /EMAIL_LOGIN_ALLOW_SIGNUP/);
  assert.match(env, /EMAIL_LOGIN_TTL_MINUTES/);
});
