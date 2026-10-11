import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("the account-type picker is shared by every signup method", () => {
  const picker = read("src/components/profile/RolePicker.tsx");
  assert.match(picker, /name="account_role"/);
  assert.match(picker, /id: "artist"/);
  assert.match(picker, /role="radiogroup"/);

  const passwordForm = read("src/components/profile/AuthForm.tsx");
  assert.match(passwordForm, /<RolePicker value=\{role\} onChange=\{setRole\}/);
  assert.match(passwordForm, /role=\{role\}/); // forwarded to GoogleButton
  assert.match(passwordForm, /onRoleChange=\{setRole\}/); // forwarded to EmailCodeForm

  const codeForm = read("src/components/profile/EmailCodeForm.tsx");
  assert.match(codeForm, /<RolePicker value=\{role\} onChange=\{onRoleChange\}/);
  assert.match(codeForm, /JSON\.stringify\(\{ email: address, locale, entry, role, returnTo \}\)/);
});

test("the e-mail code record carries the requested role and only for signups", () => {
  const store = read("src/lib/auth/email-code.ts");
  assert.match(store, /role: "user" \| "artist";/);
  assert.match(store, /role: input\.entry === "signup" && input\.role === "artist" \? "artist" : "user"/);
  // both verification paths hand the role back to the caller
  assert.match(store, /return \{ ok: true, role: record\.role \?\? "user"/);
  assert.match(store, /role: record\.role \?\? "user",/);
});

test("verifying a seller signup code creates or upgrades the account", () => {
  const route = read("src/app/api/auth/email/verify/route.ts");
  assert.match(route, /createUser\(nameFromEmail\(email\), email, randomPassword\(\), verified\.role\)/);
  assert.match(route, /maybeUpgradeToArtist/);
  assert.match(route, /upgradeUserToArtist\(account\.id\)/);
  assert.match(route, /verified\.entry === "signup" && verified\.role === "artist"/);
  // artists land on their dashboard, buyers on the account page
  assert.match(route, /isArtist \? `\/\$\{locale\}\/artist` : undefined/);
});

test("the Google flow only honours the seller role for a signup entry", () => {
  const google = read("src/lib/oauth/google.ts");
  assert.match(google, /entry === "signup" && options\.wantsArtist/);
  assert.match(google, /a: "artist" as const/);

  const start = read("src/app/api/auth/google/start/route.ts");
  assert.match(start, /const wantsArtist = body\?\.role === "artist"/);
  assert.match(start, /wantsArtist,/);

  const callback = read("src/app/api/auth/google/callback/route.ts");
  assert.match(callback, /payload\.e === "signup" && payload\.a === "artist"/);
  assert.match(callback, /upgradeUserToArtist\(stored\.id\)/);
});

test("buyer → seller upgrade is self-service but never for someone else's account", () => {
  const route = read("src/app/api/artist/upgrade/route.ts");
  assert.match(route, /const session = await getSession\(\)/);
  assert.match(route, /findUserById\(session\.id\)/); // the caller's own record only
  assert.match(route, /verifyCsrf\(req, await cookies\(\)\)/);
  assert.match(route, /tooManyAttempts\(key\)/);
  assert.match(route, /SESSION_COOKIE, await createSessionToken\(nextSession\)/);
});

test("upgradeUserToArtist is idempotent", () => {
  const users = read("src/lib/data/users.ts");
  assert.match(users, /export async function upgradeUserToArtist\(/);
  assert.match(users, /if \(user\.role === "artist" \|\| user\.role === "admin"\) \{\s*\n\s*return \{ user, createdProfile: false \}/);
  // the pending showcase profile is the same one the seller registration creates
  assert.match(users, /user\.artistId \?\? \(await createPendingArtist\(user\.id, user\.name, user\.email, extra\)\)/);
});

test("the seller form upgrades an existing buyer instead of failing on email_taken", () => {
  const form = read("src/components/profile/CreatorSignupForm.tsx");
  assert.match(form, /const isUpgrade = user\?\.role === "user"/);
  assert.match(form, /fetch\("\/api\/artist\/upgrade", withCsrf\(/);
  assert.match(form, /\{!isUpgrade && \(/); // password fields disappear in upgrade mode

  const signup = read("src/app/api/auth/signup/route.ts");
  assert.match(signup, /current\.email\.toLowerCase\(\) === email && current\.role === "user"/);
});
