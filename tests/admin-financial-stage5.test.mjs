import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const adminApp = fs.readFileSync("src/components/admin/AdminApp.tsx", "utf8");
const financialManager = fs.readFileSync("src/components/admin/FinancialManager.tsx", "utf8");
const contentRoute = fs.readFileSync("src/app/api/admin/content/route.ts", "utf8");
const contentStore = fs.readFileSync("src/lib/data/store.ts", "utf8");
const marketplaceAdminRoute = fs.readFileSync("src/app/api/marketplace/admin/route.ts", "utf8");
const marketplaceConsole = fs.readFileSync("src/components/marketplace/AdminConsole.tsx", "utf8");
const marketplaceAssets = fs.readFileSync("src/lib/marketplace/assets.ts", "utf8");

test("admin content saves carry ETags and expose a recoverable conflict path", () => {
  assert.match(adminApp, /r\.headers\.get\("ETag"\)/);
  assert.match(adminApp, /"If-Match": `"\$\{contentEtag\}"`/);
  assert.match(adminApp, /class ContentConflictError/);
  assert.match(adminApp, /بارگذاری نسخهٔ سرور/);
  assert.doesNotMatch(adminApp, /\/api\/marketplace\/admin/);

  assert.match(contentRoute, /res\.headers\.set\("ETag"/);
  assert.match(contentRoute, /expectedEtag\(req\)/);
  assert.match(contentRoute, /precondition_required/);
  assert.match(contentRoute, /status: 409/);
  assert.match(contentStore, /compareAndSet\(previous: string \| null/);
  assert.match(contentStore, /withFileContentLock/);
  assert.match(contentStore, /await fs\.rename\(temporary, FILE\)/);
  assert.match(marketplaceAdminRoute, /financial_settings_managed_by_content_admin/);
  assert.doesNotMatch(marketplaceAdminRoute, /saveContent\(/);
  assert.match(marketplaceConsole, /disabled\s+onChange=\{\(\) => undefined\}/);
  const settingsSave = marketplaceConsole.match(/async function saveSettings\(\) \{([\s\S]*?)\n  \}/)?.[0] ?? "";
  assert.match(settingsSave, /affiliateDiscountPct/);
  assert.doesNotMatch(settingsSave, /vatPct|artistSharePct|affiliatePct|payoutMinimum/);
  assert.match(marketplaceAssets, /financialConfig in SiteContent is canonical/);
});

test("inactive financial policies are preserved but read-only, separate from active runtime settings", () => {
  assert.match(financialManager, /تنظیم فعال/);
  assert.match(financialManager, /سیاست ذخیره‌شده، غیرفعال/);
  assert.match(financialManager, /value=\{config\.directCommissionPct\}[\s\S]{0,250}disabled/);
  assert.match(financialManager, /<fieldset[\s\S]{0,150}disabled[\s\S]*?subscriptionPricing\.studioAnnual\.en/);
  assert.match(financialManager, /value=\{config\.freeShippingThresholdFa\}[\s\S]{0,200}disabled/);
  assert.match(financialManager, /value=\{config\.vatPct\}[\s\S]{0,250}onChange/);
});

test("local content ETags compare-and-write atomically and reject stale concurrent saves", async () => {
  const previousCwd = process.cwd();
  const previousNodeEnv = process.env.NODE_ENV;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-content-etag-"));
  process.chdir(tempDirectory);
  process.env.NODE_ENV = "test";

  try {
    const seedContent = {
      artists: [],
      education: [],
      portfolios: [],
      portfolioCategories: [],
      siteMigrations: ["razieh-textile-portfolio-v1"],
    };
    const moduleExports = {};
    const baseRequire = createRequire(import.meta.url);
    const mockRequire = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "./seed") return { seedContent };
      if (specifier === "@/lib/media-storage") return { rewriteLegacyMediaUrls: (content) => content };
      if (specifier === "./razieh-textile-portfolio") {
        return { RAZIEH_TEXTILE_CATEGORY: {}, RAZIEH_TEXTILE_PORTFOLIO: {} };
      }
      return baseRequire(specifier);
    };
    const compiled = ts.transpileModule(contentStore, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    new Function("exports", "require", compiled)(moduleExports, mockRequire);

    const [seed, seedEtag] = await moduleExports.getContentWithEtag();
    assert.ok(seedEtag, "seed content must have a conditional-write ETag");

    const firstEtag = await moduleExports.saveContent({ ...seed, revision: "first" }, seedEtag);
    const [first, confirmedFirstEtag] = await moduleExports.getContentWithEtag();
    assert.equal(first.revision, "first");
    assert.equal(confirmedFirstEtag, firstEtag);

    const concurrentResults = await Promise.allSettled([
      moduleExports.saveContent({ ...first, revision: "writer-a" }, firstEtag),
      moduleExports.saveContent({ ...first, revision: "writer-b" }, firstEtag),
    ]);
    assert.equal(concurrentResults.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = concurrentResults.find((result) => result.status === "rejected");
    assert.equal(rejected.reason.message, "etag_conflict");

    const [current, currentEtag] = await moduleExports.getContentWithEtag();
    await assert.rejects(
      moduleExports.saveContent({ ...current, revision: "stale" }, firstEtag),
      /etag_conflict/,
    );
    await assert.rejects(moduleExports.resetContent(firstEtag), /etag_conflict/);
    assert.ok(["writer-a", "writer-b"].includes(current.revision));

    const resetEtag = await moduleExports.resetContent(currentEtag);
    const [reset, actualResetEtag] = await moduleExports.getContentWithEtag();
    assert.equal(reset.revision, undefined);
    assert.equal(actualResetEtag, resetEtag);
  } finally {
    process.chdir(previousCwd);
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
