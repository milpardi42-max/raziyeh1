import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

function loadPayoutDecisions(initialPayouts = []) {
  const collections = new Map([
    ["payouts", initialPayouts],
    ["ledger", []],
  ]);
  let sequence = 0;
  const moduleExports = {};
  const baseRequire = createRequire(import.meta.url);
  const mocks = {
    "server-only": {},
    "./store": {
      KEYS: { payouts: "payouts", ledger: "ledger" },
      async mutateCollection(key, mutate) {
        const state = collections.get(key) ?? [];
        const result = await mutate(state);
        if (result.next) collections.set(key, result.next);
        return result.result;
      },
      async readCollection(key) {
        return collections.get(key) ?? [];
      },
    },
    "./assets": { newId: (prefix) => `${prefix}_${++sequence}`, getSettings: async () => ({}) },
    "./royalty": { artistBalance: () => ({}) },
    "./money": {
      addPrice: (a, b) => ({ fa: a.fa + b.fa, en: a.en + b.en }),
      clampPrice: (value) => value,
      subPrice: (a, b) => ({ fa: a.fa - b.fa, en: a.en - b.en }),
      ZERO_PRICE: { fa: 0, en: 0 },
    },
    "./orders": { getLicensesForArtist: async () => [] },
  };
  const mockRequire = (specifier) => mocks[specifier] ?? baseRequire(specifier);
  const source = fs.readFileSync("src/lib/marketplace/payouts.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("exports", "require", compiled)(moduleExports, mockRequire);
  return { decisions: moduleExports, collections };
}

function payout(status = "requested") {
  return {
    id: "payout-1",
    artistId: "artist-1",
    userId: "user-1",
    amount: { fa: 250000, en: 8 },
    method: "iban",
    destination: "IR000000000000000000000000",
    status,
    requestedAt: "2026-10-11T10:00:00.000Z",
  };
}

test("payout cannot be marked paid before approval", async () => {
  const { decisions, collections } = loadPayoutDecisions([payout("requested")]);
  const result = await decisions.decidePayout({ id: "payout-1", status: "paid", decidedBy: "admin@example.test" });
  assert.deepEqual(result, { ok: false, error: "invalid_transition" });
  assert.deepEqual(collections.get("ledger"), []);
  assert.equal(collections.get("payouts")[0].status, "requested");
});

test("paid payout writes one ledger debit and repeated decisions do not duplicate it", async () => {
  const { decisions, collections } = loadPayoutDecisions([payout("requested")]);
  const approved = await decisions.decidePayout({
    id: "payout-1",
    status: "approved",
    decidedBy: "admin@example.test",
    reference: "approval-ref",
    note: "checked",
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.payout.status, "approved");

  const paid = await decisions.decidePayout({
    id: "payout-1",
    status: "paid",
    decidedBy: "admin@example.test",
    reference: "bank-transfer-123",
    note: "sent",
  });
  assert.equal(paid.ok, true);
  assert.equal(paid.payout.status, "paid");
  assert.equal(paid.payout.reference, "bank-transfer-123");
  assert.equal(collections.get("ledger").length, 1);
  assert.deepEqual(collections.get("ledger")[0].amount, { fa: -250000, en: -8 });

  const repeated = await decisions.decidePayout({
    id: "payout-1",
    status: "paid",
    decidedBy: "admin@example.test",
    note: "reconciled",
  });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.statusChanged, false);
  assert.equal(collections.get("payouts")[0].note, "reconciled");
  assert.equal(collections.get("ledger").length, 1);
});

test("a retry repairs a missing ledger row for an already-paid payout", async () => {
  const { decisions, collections } = loadPayoutDecisions([payout("paid")]);
  const retry = await decisions.decidePayout({ id: "payout-1", status: "paid", decidedBy: "admin@example.test" });
  assert.equal(retry.ok, true);
  assert.equal(retry.statusChanged, false);
  assert.equal(collections.get("ledger").length, 1);
});
