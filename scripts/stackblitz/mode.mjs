/**
 * Decides whether `npm run dev` should start Next with the WebContainer
 * async-context mitigation, or as plain Node development.
 *
 * Detection signals (any one enables mitigation in auto mode):
 *  - process.versions.webcontainer  (injected by StackBlitz WebContainer)
 *  - @blitz/internal/env module     (present only inside WebContainer)
 *  - WEBCONTAINER=1                 (some WebContainer-based platforms)
 *  - cwd under /home/projects/      (StackBlitz project mount layout)
 *
 * Explicit overrides always win:
 *  - ROSIE_STACKBLITZ=1 or --force  → mitigation mode
 *  - ROSIE_STACKBLITZ=0             → plain mode (never mitigated)
 *
 * On ordinary machines none of the signals match, so `npm run dev`
 * behaves exactly like it did before this launcher existed.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function isWebContainerRuntime(env = process.env, versions = process.versions, cwd = process.cwd()) {
  if (versions?.webcontainer != null) return true;
  try {
    require("@blitz/internal/env"); // exists only inside WebContainer
    return true;
  } catch {
    // not a webcontainer runtime module — continue with the other signals
  }
  if (env.WEBCONTAINER === "1") return true;
  if (/^\/home\/projects\//.test(cwd)) return true;
  return false;
}

/**
 * @returns {"plain"|"mitigate"} plus the reason, for logging.
 */
export function resolveDevMode({
  force = false,
  env = process.env,
  versions = process.versions,
  cwd = process.cwd(),
} = {}) {
  const explicit = env.ROSIE_STACKBLITZ;
  if (force || explicit === "1") return { mode: "mitigate", reason: "forced (ROSIE_STACKBLITZ=1 / --force)" };
  if (explicit === "0") return { mode: "plain", reason: "disabled (ROSIE_STACKBLITZ=0)" };
  if (isWebContainerRuntime(env, versions, cwd)) return { mode: "mitigate", reason: "webcontainer runtime detected" };
  return { mode: "plain", reason: "ordinary node runtime" };
}
