import { test } from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { diagnose } from "../scripts/stackblitz/diagnose.mjs";
import { resolveDevMode, isWebContainerRuntime } from "../scripts/stackblitz/mode.mjs";

const require = createRequire(import.meta.url);
const { bindScheduler, install } = require("../scripts/stackblitz/async-context.cjs");

test("context binding restores nested concurrent stores after a context-losing scheduler", async () => {
  const first = new AsyncLocalStorage(), second = new AsyncLocalStorage();
  const foreign = new AsyncResource("foreign-context");
  const lossy = callback => setImmediate(() => foreign.runInAsyncScope(callback));
  await first.run("control", () => new Promise(resolve => lossy(() => {
    assert.equal(first.getStore(), undefined); resolve();
  })));
  const fixed = bindScheduler(lossy);
  await Promise.all(Array.from({ length: 40 }, (_, id) => first.run(id, () => second.run(`nested-${id}`, () => new Promise(resolve => {
    fixed(() => {
      assert.equal(first.getStore(), id);
      assert.equal(second.getStore(), `nested-${id}`);
      resolve();
    });
  })))));
  assert.equal(first.getStore(), undefined);
  assert.equal(second.getStore(), undefined);
  foreign.emitDestroy();
});

test("wrapped timers retain cancellation, callback arguments and promisify hooks", async () => {
  const wrapped = bindScheduler(setTimeout);
  assert.equal(wrapped[promisify.custom], setTimeout[promisify.custom]);
  let fired = false;
  const handle = wrapped(() => { fired = true; }, 100);
  clearTimeout(handle);
  await new Promise(resolve => wrapped((value) => { assert.equal(value, "ok"); resolve(); }, 1, "ok"));
  assert.equal(fired, false);
  assert.throws(() => wrapped(null, 0), TypeError);
});

test("installer is idempotent and diagnostic concurrency probes pass", async () => {
  install(); const queue = queueMicrotask; install();
  assert.equal(queueMicrotask, queue);
  assert.deepEqual(await diagnose(), []);
});

test("preload does not change ordinary Node development or production", () => {
  for (const [NODE_ENV, ROSIE_STACKBLITZ] of [["development", ""], ["production", "1"]]) {
    const result = spawnSync(process.execPath, ["-e", `const before=queueMicrotask; require('./scripts/stackblitz/async-context.cjs'); if(before!==queueMicrotask) process.exit(1)`], { cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: "", NODE_ENV, ROSIE_STACKBLITZ } });
    assert.equal(result.status, 0, result.stderr.toString());
  }
});

test("preload is inherited by forked processes through NODE_OPTIONS", () => {
  const preload = require.resolve("../scripts/stackblitz/async-context.cjs");
  const result = spawnSync(process.execPath, ["-e", `if(!globalThis[Symbol.for('rosie.stackblitz.async-context')]) process.exit(1)`], { env: { ...process.env, NODE_ENV: "development", ROSIE_STACKBLITZ: "1", NODE_OPTIONS: `--require ${JSON.stringify(preload)}` } });
  assert.equal(result.status, 0, result.stderr.toString());
});

test("dev mode decision: ordinary node stays plain, webcontainer signals trigger mitigation", () => {
  const empty = { ...process.env, ROSIE_STACKBLITZ: "" };
  delete empty.WEBCONTAINER;

  // Ordinary machine: no signal → plain (unchanged behaviour)
  assert.equal(resolveDevMode({ env: empty, cwd: "/home/user/project" }).mode, "plain");
  assert.equal(resolveDevMode({ env: empty, versions: {}, cwd: "/home/user/project" }).mode, "plain");

  // WebContainer signals (any one) → mitigate
  assert.equal(resolveDevMode({ env: empty, versions: { webcontainer: "1" }, cwd: "/app" }).mode, "mitigate");
  assert.equal(resolveDevMode({ env: { ...empty, WEBCONTAINER: "1" }, cwd: "/app" }).mode, "mitigate");
  assert.equal(resolveDevMode({ env: empty, cwd: "/home/projects/llqimvqnxv.github" }).mode, "mitigate");

  // Explicit overrides always win
  assert.equal(resolveDevMode({ env: { ...empty, ROSIE_STACKBLITZ: "1" }, cwd: "/home/user/project" }).mode, "mitigate");
  assert.equal(resolveDevMode({ force: true, env: empty, cwd: "/home/user/project" }).mode, "mitigate");
  assert.equal(resolveDevMode({ env: { ...empty, ROSIE_STACKBLITZ: "0" }, versions: { webcontainer: "1" } }).mode, "plain");
});

test("isWebContainerRuntime accepts the injected versions field and rejects ordinary runtimes", () => {
  assert.equal(isWebContainerRuntime({}, { webcontainer: "0.1" }, "/app"), true);
  assert.equal(isWebContainerRuntime({ WEBCONTAINER: "1" }, {}, "/app"), true);
  assert.equal(isWebContainerRuntime({}, {}, "/home/projects/xyz"), true);
  assert.equal(isWebContainerRuntime({}, { node: "22" }, "/home/user/project"), false);
});
