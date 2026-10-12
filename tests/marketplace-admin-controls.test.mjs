import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("refund requires a second confirmation that explains license revocation", () => {
  const ui = read("src/components/marketplace/AdminConsole.tsx");
  const route = read("src/app/api/marketplace/admin/orders/route.ts");
  assert.match(ui, /if \(action === "refund"\)[\s\S]*?does not return money through the gateway[\s\S]*?Issued licenses will be revoked[\s\S]*?window\.confirm\(message\)/);
  assert.match(ui, /order\.status === "paid"[\s\S]*?Record refund/);
  assert.match(route, /case "refund"[\s\S]*?adminOps\.refundOrder\(body\.orderId, auth\.user\.email\)/);
});

test("payout decisions send their reference and note and enforce idempotent status transitions", () => {
  const ui = read("src/components/marketplace/AdminConsole.tsx");
  const route = read("src/app/api/marketplace/admin/payouts/route.ts");
  const decisions = read("src/lib/marketplace/payouts.ts");

  assert.match(ui, /reference:\s*payoutReference\[payoutId\]/);
  assert.match(ui, /note:\s*payoutNote\[payoutId\]/);
  assert.match(ui, /value=\{payoutReference\[payout\.id\]/);
  assert.match(ui, /value=\{payoutNote\[payout\.id\]/);
  assert.match(ui, /payout\.status === "approved"[\s\S]*?payoutAction\("paid"/);
  assert.match(ui, /Only confirm after the transfer is complete/);
  assert.match(route, /reference:\s*body\.reference/);
  assert.match(route, /note:\s*body\.note/);
  assert.match(decisions, /payout\.status === "requested"[\s\S]*?input\.status === "approved"/);
  assert.match(decisions, /invalid_transition/);
  assert.match(decisions, /entry\.kind === "payout" && entry\.payoutId === decision\.payout\.id/);
});

test("marketplace admin exposes asset lifecycle controls and blocks destructive purge when referenced", () => {
  const ui = read("src/components/marketplace/AdminConsole.tsx");
  const route = read("src/app/api/marketplace/admin/review/route.ts");
  const admin = read("src/lib/marketplace/admin.ts");
  const assets = read("src/lib/marketplace/assets.ts");
  const orders = read("src/lib/marketplace/orders.ts");

  assert.match(ui, /id: "assets"/);
  assert.match(ui, /assetAction\("delist"/);
  assert.match(ui, /assetAction\("relist"/);
  assert.match(ui, /assetAction\("purge"/);
  assert.match(route, /view"\) === "assets"[\s\S]*?getManagedAssets\(\)/);
  assert.match(admin, /orders\.filter\(\(order\) => order\.lines\.some\(\(line\) => line\.assetId === assetId\)\)/);
  assert.match(admin, /licenses\.filter\(\(license\) => license\.assetId === assetId\)/);
  assert.match(admin, /session\.status === "open" && session\.attachToAssetId === assetId/);
  assert.match(orders, /asset\.visibility !== "public"[\s\S]*?not_for_sale/);
  assert.match(route, /fail\("asset_referenced", 409, \{ references: result\.references \}\)/);
  assert.match(route, /fail\("purge_cleanup_failed", 502\)/);
  assert.match(assets, /\.\.\.\(asset\.colourways \?\? \[\]\)\.flatMap/);
  assert.match(assets, /colourway\.files\.map\(\(file\) => file\.key\)/);
  assert.match(assets, /Do not remove the catalog record if storage cleanup fails/);
  assert.match(read("src/lib/marketplace/storage.ts"), /s3_delete_\$\{response\.status\}/);
});

test("site reset confirmation describes the content-only scope", () => {
  const app = read("src/components/admin/AdminApp.tsx");
  const route = read("src/app/api/admin/content/route.ts");
  const store = read("src/lib/data/store.ts");
  assert.match(app, /فقط سند محتوای سایت/);
  assert.match(app, /حساب‌های کاربری، سفارش‌ها، گفتگوها، رزروها/);
  assert.match(route, /resetContent\(match\)/);
  assert.match(store, /export async function resetContent/);
  assert.match(store, /await file\.remove\(\)/);
});
