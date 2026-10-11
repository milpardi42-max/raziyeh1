/**
 * Make the standalone build runnable.
 *
 * `next build` writes `dist/.next/standalone` but does **not** copy the two folders the
 * server needs at runtime: `public/` (images, fonts, the academy preview video) and
 * `dist/.next/static/` (the CSS/JS chunks). Without them the server boots and answers
 * HTML, but every stylesheet, script, image and `/_next/image` request 404s.
 *
 * Runs automatically as `postbuild`, and can be re-run any time:
 *   node scripts/sync-standalone.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, "dist/.next/standalone");

if (!existsSync(standalone)) {
  // Hosts that deploy the standard `.next` output have nothing to sync — never fail a build here.
  console.log("ℹ dist/.next/standalone not found — skipping standalone sync.");
  process.exit(0);
}

const copies = [
  { from: join(root, "public"), to: join(standalone, "public"), label: "public/" },
  { from: join(root, "dist/.next/static"), to: join(standalone, "dist/.next/static"), label: "dist/.next/static/" },
];

let failed = false;
for (const { from, to, label } of copies) {
  if (!existsSync(from)) {
    console.error(`✖ ${label} missing in the build output`);
    failed = true;
    continue;
  }
  cpSync(from, to, { recursive: true, force: true });
  console.log(`✓ ${label} → ${to.slice(root.length + 1)} (${countFiles(to)} files)`);
}

/*
 * The SMTP client is loaded with a dynamic import (`webpackIgnore`), so the bundler never
 * sees it and it is missing from the standalone tree. Without this copy a container built
 * from the Dockerfile answers `smtp_requires_nodemailer` as soon as SMTP_* is configured.
 */
const nodemailerSource = join(root, "node_modules/nodemailer");
const nodemailerTarget = join(standalone, "node_modules/nodemailer");
if (existsSync(nodemailerSource)) {
  mkdirSync(join(standalone, "node_modules"), { recursive: true });
  cpSync(nodemailerSource, nodemailerTarget, { recursive: true, force: true });
  console.log(`✓ node_modules/nodemailer → node_modules/nodemailer (${countFiles(nodemailerTarget)} files)`);
} else {
  console.log("ℹ node_modules/nodemailer is absent — SMTP would report smtp_requires_nodemailer (RESEND_API_KEY is unaffected).");
}

console.log(failed ? "✖ standalone is incomplete" : "✓ standalone ready: node dist/.next/standalone/server.js");
process.exit(failed ? 1 : 0);

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}
