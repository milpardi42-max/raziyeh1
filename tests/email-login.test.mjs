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
  assert.match(route, /const devMode = outboxOnly && \(process\.env\.NODE_ENV !== "production" \|\| testMode\)/);
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
  assert.match(route, /outboxOnly && process\.env\.NODE_ENV === "production" && !testMode/);
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

test("test mode is explicit, restrictable and honest", () => {
  const mode = read("src/lib/auth/email-login-mode.ts");
  assert.match(mode, /EMAIL_LOGIN_TEST_MODE/);
  assert.match(mode, /EMAIL_LOGIN_TEST_EMAILS/);
  assert.match(mode, /export function emailTestModeAppliesTo\(email: string\): boolean/);
  assert.match(mode, /if \(allowed\.length === 0\) return true;/);

  const route = read("src/app/api/auth/email/request/route.ts");
  assert.match(route, /const outboxOnly = mailProvider\(\) === "outbox";/);
  assert.match(route, /const testMode = outboxOnly && emailTestModeAppliesTo\(email\);/);
  assert.match(route, /outboxOnly && process\.env\.NODE_ENV === "production" && !testMode/);
  // production test mode logs a warning every time it hands out a code
  assert.match(route, /\[email-login\] TEST MODE is active in production/);

  const status = read("src/app/api/auth/email/status/route.ts");
  assert.match(status, /testMode: !realDelivery,/);
  assert.match(status, /testEmails: testMode \? emailTestModeAddresses\(\) : \[\]/);
});

test("a Linux host can install the project and send real e-mail", () => {
  const pkg = JSON.parse(read("package.json"));
  // The SMTP client must ship with the app: a real host should need no extra install.
  assert.ok(pkg.dependencies.nodemailer, "nodemailer should be a dependency");
  // A Windows-only SWC binary listed as a *dependency* makes `npm ci` fail with EBADPLATFORM
  // on Linux — i.e. on Docker/Netlify/Vercel/any VPS. Next pulls the right binary itself.
  assert.ok(!("@next/swc-win32-x64-msvc" in pkg.dependencies), "no platform-locked dependency");
  assert.ok(!("@next/swc-win32-x64-msvc" in (pkg.optionalDependencies ?? {})), "not an optional one either");

  // Docker/standalone builds must carry the dynamically-imported SMTP client along.
  const sync = read("scripts/sync-standalone.mjs");
  assert.match(sync, /node_modules\/nodemailer/);
  assert.match(sync, /mkdirSync\(join\(standalone, "node_modules"\)/);

  // The GitHub-side real send helper stays secret-only and refuses to run without a target.
  const workflow = read(".github/mail-test-workflow.yml.example");
  assert.match(workflow, /secrets\.RESEND_API_KEY/);
  assert.match(workflow, /secrets\.SMTP_HOST/);
  assert.match(workflow, /node scripts\/mail-test\.mjs "\$\{\{ steps\.target\.outputs\.to \}\}"/);
  assert.ok(!/echo .*RESEND_API_KEY/.test(workflow), "the workflow must never print the key");
});

test("a refused delivery is logged and never reported as success", () => {
  const route = read("src/app/api/auth/email/request/route.ts");
  // the provider's reason must reach the server log — an operator has to be able to diagnose
  assert.match(route, /console\.error\("\[email-login\] delivery failed:", delivery\.error\)/);
  // a send that threw (no result at all) is treated exactly like a refusal
  assert.match(route, /if \(!delivery \|\| delivery\.status === "failed"\)/);
  const mail = read("src/lib/auth/login-mail.ts");
  assert.match(mail, /status: string; error\?: string/);
  // …and the provider's own message must survive the hop to this route
  assert.match(mail, /return \{ id: message\.id, status: message\.status, error: message\.error \};/);
});
