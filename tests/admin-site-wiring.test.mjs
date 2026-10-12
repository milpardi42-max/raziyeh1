import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("homepage section order and visibility come from admin homeSections", () => {
  const page = read("src/app/[locale]/page.tsx");
  assert.match(page, /homeSections\.filter\(\(s\) => s\.enabled\)\.sort\(\(a, b\) => a\.order - b\.order\)/);
  assert.match(page, /sections\.map\(\(section\) =>/);
  assert.match(page, /renderSection\(section\.key\)/);
  assert.match(page, /showB2B=\{false\} showCustom/);
});

test("all banner placements and authored links have a site rendering path", () => {
  const globalBanner = read("src/components/layout/AnnouncementBarServer.tsx");
  const academy = read("src/app/[locale]/academy/page.tsx");
  const shop = read("src/app/[locale]/shop/page.tsx");
  const shopHero = read("src/components/shop/ShopHero.tsx");
  assert.match(globalBanner, /placement === "top"/);
  assert.match(globalBanner, /publicEducationItems\(site\.education\)/);
  assert.match(globalBanner, /configBars=\{site\.announcementBars \?\? \[\]\}/);
  assert.match(academy, /placement === "academy"/);
  assert.match(shop, /placement === "shop"/);
  assert.match(shopHero, /contentHref\(locale, banner\.href\)/);
  assert.match(shopHero, /banners\.map\(\(banner\)/);
});

test("financial settings use one ETag-guarded content write and remain live in marketplace checkout and royalties", () => {
  const app = read("src/components/admin/AdminApp.tsx");
  const route = read("src/app/api/marketplace/admin/route.ts");
  const orders = read("src/lib/marketplace/orders.ts");
  const settings = read("src/lib/marketplace/assets.ts");
  assert.match(app, /"If-Match": `"\$\{contentEtag\}"`/);
  assert.doesNotMatch(app, /\/api\/marketplace\/admin/);
  assert.match(route, /financial_settings_managed_by_content_admin/);
  assert.doesNotMatch(route, /saveContent\(/);
  assert.match(orders, /settings\.vatPct/);
  assert.match(orders, /marketplaceSettings\.artistSharePct/);
  assert.match(orders, /marketplaceSettings\.affiliatePct/);
  assert.match(settings, /financial\.defaultArtistSharePct/);
  assert.match(settings, /financial\.affiliateCommissionPct/);
});

test("marketplace settings control upload approval and artist sale notices", () => {
  const consoleUi = read("src/components/marketplace/AdminConsole.tsx");
  const uploads = read("src/lib/marketplace/assets.ts");
  const orders = read("src/lib/marketplace/orders.ts");
  const email = read("src/lib/marketplace/email.ts");
  assert.match(consoleUi, /checked=\{settings\.autoApproveSeamless\}/);
  assert.match(uploads, /marketplaceSettings\.autoApproveSeamless/);
  assert.match(uploads, /derivation\?\.seamless\.verdict === "seamless"/);
  assert.match(orders, /marketplaceSettings\.emailOnSale/);
  assert.match(email, /input\.notifyArtists/);
});

test("admin can update event reservation status and the status is persisted", () => {
  const route = read("src/app/api/admin/reservations/route.ts");
  const store = read("src/lib/data/reservations.ts");
  const manager = read("src/components/admin/ReservationsManager.tsx");
  assert.match(route, /export async function PATCH/);
  assert.match(route, /updateReservationStatus/);
  assert.match(store, /await writeLocal\(reservations\)/);
  assert.match(store, /return withFileLock\(async \(\) =>/);
  assert.match(store, /updateRedisReservation\(id, "status", status\)/);
  assert.match(manager, /changeStatus\(reservation\.id, "attended"\)/);
  assert.match(manager, /changeStatus\(reservation\.id, "cancelled"\)/);
});
