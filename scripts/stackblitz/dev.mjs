import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolveDevMode } from "./mode.mjs";

const require = createRequire(import.meta.url);
const preload = fileURLToPath(new URL("./async-context.cjs", import.meta.url));
const nextBin = require.resolve("next/dist/bin/next");
const diagnose = fileURLToPath(new URL("./diagnose.mjs", import.meta.url));

const args = process.argv.slice(2);
const { mode, reason } = resolveDevMode({ force: args.includes("--force") });
const userArgs = args.filter((a) => a !== "--force");

function run(commandArgs, env) {
  return new Promise((resolve) => {
    const child = spawn(commandArgs[0], commandArgs.slice(1), { env, stdio: "inherit" });
    const forward = (signal) => child.kill(signal);
    const onInt = () => forward("SIGINT");
    const onTerm = () => forward("SIGTERM");
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    child.once("error", (error) => {
      console.error(error);
      resolve(1);
    });
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", onInt);
      process.removeListener("SIGTERM", onTerm);
      resolve(code ?? (signal === "SIGINT" ? 130 : 1));
    });
  });
}

if (mode === "plain") {
  // Ordinary Node development — exactly the classic `next dev`, untouched env.
  console.log(`[dev] Plain mode (${reason}). Running: next dev ${userArgs.join(" ")}`.trimEnd());
  process.exitCode = await run([process.execPath, nextBin, "dev", ...userArgs], { ...process.env });
} else {
  console.log(`[dev] WebContainer mitigation mode (${reason}).`);
  // NODE_OPTIONS is inherited by Next's forked development server and workers too.
  const nodeOptions = `${process.env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(preload)}`.trim();
  const env = { ...process.env, ROSIE_STACKBLITZ: "1", NODE_ENV: "development", NODE_OPTIONS: nodeOptions };

  const check = await run([process.execPath, diagnose], env);
  if (check !== 0) {
    process.exitCode = check;
  } else {
    console.log("[dev] Starting Next with opt-in scheduler context binding. Keep the full log if E696 persists.");
    process.exitCode = await run([process.execPath, nextBin, "dev", "--hostname", "0.0.0.0", ...userArgs], env);
  }
}
