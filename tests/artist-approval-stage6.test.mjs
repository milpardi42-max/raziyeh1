import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("all new artist accounts and buyer-to-artist upgrades enter manual review", () => {
  const users = read("src/lib/data/users.ts");
  assert.match(users, /status: "pending" as const/);
  assert.doesNotMatch(users, /status: "approved" as const, \/\/ approved so new artists/);
  assert.match(users, /await createPendingArtist\(userId, name, email, signupExtra\)/);
  assert.match(users, /await createPendingArtist\(user\.id, user\.name, user\.email, extra\)/);

  const passwordSignup = read("src/app/api/auth/signup/route.ts");
  const emailSignup = read("src/app/api/auth/email/verify/route.ts");
  const googleSignup = read("src/app/api/auth/google/callback/route.ts");
  for (const route of [passwordSignup, emailSignup, googleSignup]) {
    assert.match(route, /createUser\(/);
    assert.match(route, /upgradeUserToArtist\(/);
  }
});

test("public site content and marketplace sales hide work owned by unapproved artists", () => {
  const profile = read("src/lib/artist/public-profile.ts");
  assert.match(profile, /return artist\.status \? artist\.status === "approved" : !artist\.userId/);
  assert.match(profile, /publicSiteContent/);
  assert.match(read("src/lib/data/queries.ts"), /publicSiteContent\(await getContent\(\)\)/);
  assert.match(read("src/app/api/search-index/route.ts"), /publicSiteContent\(await getContent\(\)\)/);
  assert.match(read("src/app/sitemap.ts"), /publicSiteContent\(content\)/);

  const assets = read("src/lib/marketplace/assets.ts");
  assert.match(assets, /getPublicArtistIds\(\)/);
  assert.match(assets, /published = assets\.filter\(\(asset\) => !asset\.artistId \|\| publicArtistIds\.has\(asset\.artistId\)\)/);
  assert.match(read("src/lib/marketplace/orders.ts"), /isPublicArtistId\(asset\.artistId\)/);
  assert.match(read("src/app/api/marketplace/assets/route.ts"), /artistCanPublishAsset\(asset\)/);
  assert.match(read("src/app/api/marketplace/media/route.ts"), /publicArtistIds\.has\(asset\.artistId\)/);
});

test("seller APIs and artist pages require current server-side approval", () => {
  const access = read("src/lib/artist/access.ts");
  assert.match(access, /getArtistApprovalStatus/);
  assert.match(access, /if \(user\.role !== "artist"\) return "missing"/);
  assert.match(access, /isPublicArtist\(artist\)/);
  assert.match(read("src/lib/marketplace/guard.ts"), /getArtistApprovalStatus\(user\)/);
  assert.match(read("src/lib/marketplace/guard.ts"), /artistApprovalError\(approval\)/);

  for (const route of [
    "src/app/api/artist/patterns/route.ts",
    "src/app/api/artist/services/route.ts",
    "src/app/api/artist/subscription/route.ts",
    "src/app/api/artist/drafts/route.ts",
    "src/app/api/artist/upload/route.ts",
  ]) {
    assert.match(read(route), /requireArtistOrAdmin as requireApprovedArtistOrAdmin/);
  }

  for (const page of [
    "src/app/[locale]/artist/page.tsx",
    "src/app/[locale]/artist/marketplace/page.tsx",
    "src/app/[locale]/account/page.tsx",
  ]) {
    assert.match(read(page), /getArtistApprovalStatus/);
    assert.match(read(page), /ArtistApprovalNotice/);
  }

  const profileRoute = read("src/app/api/artist/profile/route.ts");
  assert.match(profileRoute, /canEditSalesSettings/);
  assert.doesNotMatch(profileRoute, /body\.(services|subscription|inquiries)\s*!==\s*undefined/);
});

test("UsersManager is reachable from admin navigation and artist role changes create linked profiles", () => {
  const admin = read("src/components/admin/AdminApp.tsx");
  assert.match(admin, /import \{ UsersManager \} from "@\/components\/admin\/UsersManager"/);
  assert.match(admin, /\{ id: "users", label: "مدیریت کاربران"/);
  assert.match(admin, /section === "users" && <UsersManager onContentMutation=\{applyContentMutation\} \/>/);

  const usersApi = read("src/app/api/admin/users/route.ts");
  assert.match(usersApi, /upgradeUserToArtist\(current\.id\)/);
  assert.match(usersApi, /artist_profile_management_required/);
  assert.match(usersApi, /mutateContent\(/);
  assert.match(usersApi, /removedArtistIds/);

  const manager = read("src/components/admin/UsersManager.tsx");
  assert.match(manager, /onRoleChange\(user\.id, "artist"\)/);
  assert.match(manager, /در انتظار تأیید/);
  assert.doesNotMatch(manager, /تغییر به کاربر عادی/);

  const artistsApi = read("src/app/api/admin/artists/route.ts");
  assert.match(artistsApi, /role: "artist" as const, artistId: updated\.id/);
});
