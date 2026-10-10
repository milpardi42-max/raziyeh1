import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync("src/lib/artist/public-profile.ts", "utf8");
const exports = {};
new Function(
  "exports",
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exports);
const { isPublicArtist, publicArtist } = exports;

test("only approved and legacy public artists are visible", () => {
  assert.equal(isPublicArtist({}), true);
  assert.equal(isPublicArtist({ status: "approved" }), true);
  assert.equal(isPublicArtist({ status: "pending" }), false);
  assert.equal(isPublicArtist({ status: "rejected" }), false);
});
test("public profile strips inquiries and registration/account details", () => {
  const result = publicArtist({
    id: "a",
    slug: "artist",
    name: { fa: "هنرمند", en: "Artist" },
    inquiries: [{ clientPhone: "private" }],
    signupPhone: "private",
    userId: "private",
    rejectionNote: "private",
    services: [],
  });
  assert.equal(result.slug, "artist");
  for (const key of ["inquiries", "signupPhone", "userId", "rejectionNote"])
    assert.equal(key in result, false);
});
test("public profile exposes only active services", () => {
  const result = publicArtist({
    services: [
      { id: "on", active: true },
      { id: "off", active: false },
      { id: "legacy" },
    ],
  });
  assert.deepEqual(
    result.services.map((s) => s.id),
    ["on", "legacy"],
  );
});
test("directory and profile components contain no inquiry modal or fake follow control", () => {
  for (const file of [
    "src/components/artist/ArtistsHubView.tsx",
    "src/components/cards/ArtistCard.tsx",
    "src/components/profile/ProfileHeader.tsx",
    "src/components/profile/ProfileTabs.tsx",
  ]) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /setModalOpen|setActiveInquiryTarget|setFollowing|role="dialog"/,
    );
  }
  assert.match(
    fs.readFileSync("src/components/cards/ArtistCard.tsx", "utf8"),
    /artists\/\$\{artist.slug\}/,
  );
});
