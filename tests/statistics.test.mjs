import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Compile the pure calculation modules with the project's existing compiler.
function load(file, dependencies = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', js)(exports, (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected runtime dependency: ${name}`);
  });
  return exports;
}
const { orderStatistics } = load('src/lib/data/order-statistics.ts');
const { siteStatistics } = load('src/lib/data/statistics.ts');
const now = new Date('2026-09-27T12:00:00Z');
const order = (id, status, amount, createdAt = now.toISOString()) => ({ id, status, total: { fa: amount, en: 0 }, createdAt });

test('empty store has seven zero days, no invented records', () => {
  const result = orderStatistics([], now);
  assert.equal(result.stats.totalOrders, 0);
  assert.equal(result.stats.totalRevenue, 0);
  assert.equal(result.dailyRevenue.length, 7);
  assert.ok(result.dailyRevenue.every(d => d.revenue === 0 && d.count === 0));
  assert.deepEqual(result.recentOrders, []);
});
test('pending and cancelled amounts are not counted as accepted order value', () => {
  const result = orderStatistics([
    order('1', 'pending', 900), order('2', 'cancelled', 800),
    order('3', 'confirmed', 100), order('4', 'shipped', 200), order('5', 'delivered', 300),
    order('6', 'delivered', 400, '2026-09-01T12:00:00Z'),
  ], now);
  assert.equal(result.stats.totalOrders, 6);
  assert.equal(result.stats.pendingOrders, 1);
  assert.equal(result.stats.totalRevenue, 1000);
  assert.equal(result.stats.todayRevenue, 600);
  assert.equal(result.dailyRevenue.reduce((s, d) => s + d.revenue, 0), 600);
});
test('daily buckets use Tehran midnight, not UTC midnight', () => {
  const result = orderStatistics([
    order('before', 'confirmed', 10, '2026-09-26T20:29:59Z'),
    order('after', 'confirmed', 20, '2026-09-26T20:30:00Z'),
  ], now);
  assert.equal(result.dailyRevenue.at(-2).revenue, 10);
  assert.equal(result.dailyRevenue.at(-1).revenue, 20);
  assert.equal(result.recentOrders[0].id, 'after');
});
test('public counts are exact and project count excludes non-project portfolios', () => {
  assert.deepEqual(siteStatistics({ patterns: [{}, {}], artists: [{}], portfolios: [{ isProject: true }, { isProject: false }] }), { patterns: 2, artists: 1, projects: 1 });
  assert.deepEqual(siteStatistics({ patterns: [], artists: [], portfolios: [] }), { patterns: 0, artists: 0, projects: 0 });
});
test('founder metrics are scoped to their records and unique active registrants', async () => {
  const id = 'artist-razieh-khairipour';
  const { founderStatistics } = load('src/lib/data/founder-statistics.ts', {
    'server-only': {}, './reservations': { getAllReservations: async () => [
      { eventSlug: 'own', status: 'confirmed', email: 'A@example.com' },
      { eventSlug: 'own', status: 'confirmed', email: ' a@example.com ' },
      { eventSlug: 'own', status: 'cancelled', email: 'b@example.com' },
      { eventSlug: 'other', status: 'confirmed', email: 'c@example.com' },
    ] },
  });
  const result = await founderStatistics({ patterns: [{ artistId: id }, { artistId: 'other' }], portfolios: [], education: [{ authorId: id, slug: 'own' }] });
  assert.deepEqual(result.map(s => s.value.en), ['1', '0', '1', '1']);
});
