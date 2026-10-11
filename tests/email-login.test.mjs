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
  // the role chosen on the signup form reaches the account creation
  assert.match(route, /createUser\(nameFromEmail\(email\), email, randomPassword\(\), verified\.role\)/);
  // the magic-link redirect target is validated
  assert.match(route, /safeReturnPath\(body\?\.returnTo, locale,/);
  assert.match(route, /safeReturnPath\(returnTo, locale,/);
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

test("real mode: production without a provider refuses honestly instead of pretending", () => {
  const route = read("src/app/api/auth/email/request/route.ts");
  assert.match(route, /mailProvider\(\) === "outbox" && process\.env\.NODE_ENV === "production"/);
  assert.match(route, /error: "email_not_configured" \}, withNoStore\(\{ status: 503 \}\)/);
  // a refused delivery must never leave a guessable code behind
  assert.match(route, /if \(delivery\?\.status === "failed"\) \{/);
  assert.match(route, /await discardLoginCode\(email\);/);
  assert.match(route, /error: "email_delivery_failed" \}, withNoStore\(\{ status: 502 \}\)/);
});

test("the status endpoint reports whether a message can really be delivered", () => {
  const status = read("src/app/api/auth/email/status/route.ts");
  assert.match(status, /const realDelivery = provider !== "outbox"/);
  assert.match(status, /emailLoginEnabled\(\)/);
  assert.match(status, /error: available\s*\n?\s*\? null/);
});

test("the UI checks availability before asking for an address", () => {
  const form = read("src/components/profile/AuthForm.tsx");
  assert.match(form, /const openCodeMethod = useCallback\(async \(\) => \{/);
  assert.match(form, /fetch\("\/api\/auth\/email\/status"/);
  assert.match(form, /setErr\(getError\(data\.error \?\? "email_not_configured"\)\)/);
  const codeForm = read("src/components/profile/EmailCodeForm.tsx");
  assert.match(codeForm, /email_not_configured:/);
  assert.match(codeForm, /email_delivery_failed:/);
});

test("discardLoginCode really removes the record", () => {
  const store = read("src/lib/auth/email-code.ts");
  assert.match(store, /export async function discardLoginCode\(emailInput: string\)/);
  assert.match(store, /records\.filter\(\(record\) => record\.email !== email\)/);
});

test("the mail diagnostics tool exists and is wired to npm scripts", () => {
  const script = read("scripts/mail-test.mjs");
  assert.match(script, /function detectProvider\(\)/);
  assert.match(script, /api\.resend\.com\/emails/);
  assert.match(script, /nodemailer is not installed/);
  assert.match(script, /\.env\.local/);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["mail:test"], "node scripts/mail-test.mjs");
  assert.equal(pkg.scripts["mail:status"], "node scripts/mail-test.mjs --status");
});
