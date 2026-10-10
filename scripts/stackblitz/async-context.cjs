/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { AsyncResource } = require("node:async_hooks");
const timers = require("node:timers");
const { syncBuiltinESMExports } = require("node:module");

/**
 * Development-only mitigation for callback schedulers that drop async context.
 * Capture at scheduling time, not at callback time. Never invent a request store,
 * suppress Next invariants or share authentication state between requests.
 * This is deliberately opt-in: it is NOT an upstream WebContainer fix.
 */
function bindScheduler(schedule) {
  function contextPreservingScheduler(callback, ...args) {
    // Delegate validation (and native error behavior) for invalid callbacks.
    if (typeof callback !== "function") return schedule(callback, ...args);
    return schedule(AsyncResource.bind(callback), ...args);
  }
  // Keep promisify.custom, timer properties and symbols intact.
  for (const key of Reflect.ownKeys(schedule)) {
    if (!["name", "length", "prototype", "caller", "arguments"].includes(key)) {
      Object.defineProperty(contextPreservingScheduler, key, Object.getOwnPropertyDescriptor(schedule, key));
    }
  }
  return contextPreservingScheduler;
}

function install() {
  const marker = Symbol.for("rosie.stackblitz.async-context");
  if (globalThis[marker]) return;
  globalThis[marker] = true;
  globalThis.queueMicrotask = bindScheduler(globalThis.queueMicrotask);
  for (const name of ["setImmediate", "setTimeout"]) {
    const wrapped = bindScheduler(timers[name]);
    timers[name] = wrapped;
    globalThis[name] = wrapped;
  }
  syncBuiltinESMExports();
}

module.exports = { bindScheduler, install };
if (process.env.ROSIE_STACKBLITZ === "1" && process.env.NODE_ENV !== "production") install();
