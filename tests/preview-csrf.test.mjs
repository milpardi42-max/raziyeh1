import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("a browser-vouched same-origin request is accepted before the cookie check", () => {
  const csrf = read("src/lib/security/csrf.ts");
  assert.match(csrf, /export function isSameOriginRequest\(req: NextRequest\): boolean/);
  assert.match(csrf, /sec-fetch-site"\)\?\.trim\(\)\.toLowerCase\(\) === "same-origin"/);
  // host comparison ignores the port (proxies keep or drop it), and Referer is
  // the fallback when a proxy strips Origin
  assert.match(csrf, /new URL\(value\)\.hostname\.toLowerCase\(\) === expected/);
  assert.match(csrf, /for \(const header of \["origin", "referer"\] as const\)/);
  // the acceptance happens *before* the double-submit cookie check
  const acceptance = csrf.indexOf("if (isSameOriginRequest(req)) return { ok: true };");
  const cookieCheck = csrf.indexOf("const cookieToken = cookies.get(CSRF_COOKIE)?.value;");
  assert.ok(acceptance > 0 && cookieCheck > acceptance, "same-origin check must run first");
});

test("rejected requests leave a diagnostic trace in the server log", () => {
  const csrf = read("src/lib/security/csrf.ts");
  assert.match(csrf, /\[csrf\] rejected request/);
  assert.match(csrf, /secFetchSite: req\.headers\.get\("sec-fetch-site"\)/);
  assert.match(csrf, /origin: req\.headers\.get\("origin"\)/);
});

test("client-side fetch still sends the token when the cookie exists", () => {
  const client = read("src/lib/security/csrf-client.ts");
  assert.match(client, /getCsrfCookie\(\)/);
  assert.match(client, /headers\.set\(CSRF_HEADER, token\)/);
  // no cookie → the request is still sent (the server now accepts same-origin)
  assert.match(client, /if \(!token\) return init;/);
});

test("every form explains a CSRF rejection and a blocked session cookie", () => {
  for (const file of [
    "src/components/profile/EmailCodeForm.tsx",
    "src/components/profile/AuthForm.tsx",
  ]) {
    const form = read(file);
    assert.match(form, /csrf_missing:/, file);
    assert.match(form, /session_cookie_blocked:/, file);
    assert.match(form, /sessionCookieWorks\(\)/, file);
  }
  const creator = read("src/components/profile/CreatorSignupForm.tsx");
  assert.match(creator, /csrf_missing:/);
});

test("sessionCookieWorks only warns when the answer is trustworthy", () => {
  const helper = read("src/lib/auth/session-client.ts");
  assert.match(helper, /if \(!res\.ok\) return true;/);
  assert.match(helper, /catch \{\s*\n\s*return true;/);
  assert.match(helper, /return Boolean\(data\?\.user\)/);
});

test("a corrupt users file degrades to an empty list instead of a 500", () => {
  const users = read("src/lib/data/users.ts");
  const fileRead = users.slice(users.indexOf("async function fileRead"), users.indexOf("async function fileWrite"));
  assert.match(fileRead, /if \(!json\.trim\(\)\) return \[\];/);
  assert.match(fileRead, /charCodeAt\(0\) === 0xfeff/);
  // no re-throw of parse errors
  assert.doesNotMatch(fileRead, /throw error;/);
});
