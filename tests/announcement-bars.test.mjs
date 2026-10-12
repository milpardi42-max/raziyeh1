import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/announcement-bars.ts", "utf8");
const exports = {};
new Function(
  "exports",
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(exports);

const {
  getAnnouncementBarPreview,
  getAnnouncementBarRowState,
  getNextAnnouncementBarExpiryAt,
  isAnnouncementBarExpired,
  selectAnnouncementBar,
  setSingleEnabledAnnouncementBar,
} = exports;

function makeBar(id, kind = "custom", patch = {}) {
  return {
    id,
    kind,
    enabled: true,
    message: { fa: id, en: id },
    href: "/",
    ...patch,
  };
}

const NOW = Date.parse("2026-10-11T12:00:00.000Z");
const liveEvent = { liveEvent: { status: "live" } };

test("runtime and admin preview select the same first eligible bar", () => {
  const bars = [
    makeBar("live-waiting", "live-webinar"),
    makeBar("expired", "sale", { expiresAt: "2026-10-11T11:59:00.000Z" }),
    makeBar("custom-later"),
  ];

  assert.equal(selectAnnouncementBar(bars, null, NOW)?.id, "custom-later");
  assert.deepEqual(getAnnouncementBarPreview(bars, null, NOW), {
    state: "config",
    bar: bars[2],
  });
  assert.equal(getAnnouncementBarRowState(bars[0], bars, null, NOW), "waiting");
  assert.equal(getAnnouncementBarRowState(bars[1], bars, null, NOW), "expired");

  assert.equal(selectAnnouncementBar(bars, liveEvent, NOW)?.id, "live-waiting");
  assert.deepEqual(getAnnouncementBarPreview(bars, liveEvent, NOW), {
    state: "live-webinar",
    bar: bars[0],
  });
  assert.equal(getAnnouncementBarRowState(bars[2], bars, liveEvent, NOW), "queued");
});

test("preview distinguishes a waiting live bar from no enabled bar", () => {
  const waiting = makeBar("waiting", "live-webinar");
  assert.deepEqual(getAnnouncementBarPreview([waiting], null, NOW), { state: "waiting", bar: waiting });
  assert.deepEqual(getAnnouncementBarPreview([], null, NOW), { state: "nothing", bar: null });
});

test("expiry boundaries are safe and live webinars ignore expiry by contract", () => {
  const expired = makeBar("expired", "sale", { expiresAt: "2026-10-11T12:00:00.000Z" });
  const malformed = makeBar("malformed", "custom", { expiresAt: "not-a-date" });
  const live = makeBar("live", "live-webinar", { expiresAt: "not-a-date" });
  assert.equal(isAnnouncementBarExpired(expired, NOW), true);
  assert.equal(isAnnouncementBarExpired(malformed, NOW), true);
  assert.equal(isAnnouncementBarExpired(live, NOW), false);
  assert.equal(getNextAnnouncementBarExpiryAt([
    makeBar("future", "sale", { expiresAt: "2026-10-11T12:01:00.000Z" }),
    expired,
    live,
  ], NOW), NOW + 60_000);
});

test("enabling one bar disables other bars and disabling does not affect them", () => {
  const bars = [makeBar("a", "sale", { enabled: true }), makeBar("b", "custom", { enabled: false })];
  assert.deepEqual(setSingleEnabledAnnouncementBar(bars, "b", true).map((bar) => bar.enabled), [false, true]);
  assert.deepEqual(setSingleEnabledAnnouncementBar(bars, "a", false).map((bar) => bar.enabled), [false, false]);
});

test("runtime and the admin preview share the selection helper", () => {
  const runtime = fs.readFileSync("src/components/layout/AnnouncementBar.tsx", "utf8");
  const admin = fs.readFileSync("src/components/admin/AdminApp.tsx", "utf8");
  assert.match(runtime, /selectAnnouncementBar\(configBars, event, now, dismissedIds\)/);
  assert.match(admin, /getAnnouncementBarPreview\(bars, liveEvent, now\)/);
  assert.match(admin, /getAnnouncementBarRowState\(b, bars, liveEvent, now\)/);
  assert.match(admin, /setSingleEnabledAnnouncementBar\(bars, id, enabled\)/);
});
