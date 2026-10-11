#!/usr/bin/env node
/**
 * Mail diagnostics for the real deployment.
 *
 *   npm run mail:status                 → which provider is detected, and why
 *   npm run mail:test -- you@site.com   → send a real test message through the
 *                                         configured provider and report what
 *                                         the provider answered
 *
 * The script reads .env.local / .env exactly like Next.js does (existing shell
 * variables win), so a successful run here means the sign-in e-mails will go out
 * too. It never prints secrets — only whether they are present, and their length.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* ---------------------------------------------------------------- */
/* env                                                              */
/* ---------------------------------------------------------------- */

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Existing environment wins (that is what Next.js does as well).
    if (!(key in process.env)) out[key] = value;
  }
  return out;
}

const root = process.cwd();
const fileEnv = {
  ...parseEnvFile(resolve(root, ".env")),
  ...parseEnvFile(resolve(root, ".env.local")),
  ...parseEnvFile(resolve(root, ".env.production")),
};
const env = { ...fileEnv, ...process.env };

/* ---------------------------------------------------------------- */
/* detection — mirrors src/lib/marketplace/config.ts (mailProvider)  */
/* ---------------------------------------------------------------- */

function detectProvider() {
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_HOST && env.SMTP_USER) return "smtp";
  return "outbox";
}

function fromAddress() {
  return env.MARKETPLACE_EMAIL_FROM || env.SMTP_USER || "Rosie Atelier <no-reply@localhost>";
}

const masked = (value) => (value ? `${value.slice(0, 4)}…(${value.length} chars)` : "—");

function status() {
  const provider = detectProvider();
  console.log("Rosie Atelier · e-mail diagnostics\n");
  console.log(`  provider            : ${provider}`);
  console.log(`  from address        : ${fromAddress()}`);
  console.log(`  RESEND_API_KEY      : ${env.RESEND_API_KEY ? masked(env.RESEND_API_KEY) : "not set"}`);
  console.log(`  SMTP_HOST           : ${env.SMTP_HOST || "not set"}`);
  console.log(`  SMTP_USER           : ${env.SMTP_USER || "not set"}`);
  console.log(`  SMTP_PASS           : ${env.SMTP_PASS ? masked(env.SMTP_PASS) : "not set"}`);
  console.log(`  SMTP_SECURE         : ${env.SMTP_SECURE === "1" ? "1 (TLS)" : "0 (STARTTLS)"}`);
  console.log(`  EMAIL_LOGIN_ENABLED : ${env.EMAIL_LOGIN_ENABLED ?? "1 (default)"}`);
  console.log("");

  if (provider === "outbox") {
    console.log("  ⚠  No provider configured: sign-in codes are only written to the outbox");
    console.log("     (and shown on the page in development). In production the form now");
    console.log("     answers “email not configured” instead of promising an e-mail.");
    console.log("\n  Fix: set RESEND_API_KEY, or SMTP_HOST + SMTP_USER + SMTP_PASS in .env.local.");
  } else if (provider === "resend") {
    console.log("  ✓ Resend will deliver the messages. The From address must belong to a");
    console.log("    domain verified in your Resend account (SPF + DKIM).");
  } else {
    console.log("  ✓ SMTP will deliver the messages (the client is shipped with the app).");
  }
  console.log("");
  return provider;
}

/* ---------------------------------------------------------------- */
/* sending                                                          */
/* ---------------------------------------------------------------- */

function testMessage(to) {
  const subject = "Rosie Atelier · تست ارسال ایمیل";
  const text =
    `این یک پیام آزمایشی از سایت Rosie Atelier است.\n\n` +
    `اگر این ایمیل را می‌بینید، ارسال ایمیل سایت به‌درستی کار می‌کند و کدهای ورود هم به دست کاربران می‌رسد.\n` +
    `(این پیام آزمایشی است؛ کد ورودی در آن نیست.)`;
  const html = `<!doctype html><html dir="rtl" lang="fa"><body style="font-family:Tahoma,sans-serif;background:#f6f7f9;padding:28px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e9ef;border-radius:14px;overflow:hidden">
      <div style="background:#0f172a;color:#fff;padding:18px 22px;font-weight:700">Rosie Atelier · آتلیه رزی</div>
      <div style="padding:22px;line-height:2;color:#0f172a;font-size:14px">
        <p style="margin:0 0 12px">این یک پیام آزمایشی است.</p>
        <p style="margin:0">اگر این ایمیل را می‌بینید، ارسال ایمیل سایت درست کار می‌کند و کدهای ورود هم به دست کاربران می‌رسد.</p>
      </div>
      <div style="background:#faf7f3;padding:14px 22px;font-size:11px;color:#667085">${new Date().toISOString()}</div>
    </div></body></html>`;

  return { subject, text, html };
}

async function sendWithResend(to) {
  const { subject, text, html } = testMessage(to);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, text, html }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${body.slice(0, 300)}`);
  return body.slice(0, 200);
}

async function sendWithSmtp(to) {
  const { subject, text, html } = testMessage(to);
  let nodemailer;
  try {
    nodemailer = await import("nodemailer");
  } catch {
    throw new Error(
      "nodemailer is not installed. Run:  npm ci   (it is a normal dependency of this app)",
    );
  }
  const transporter = nodemailer.default.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 587),
    secure: env.SMTP_SECURE === "1",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  const info = await transporter.sendMail({ from: fromAddress(), to, subject, text, html });
  return info.messageId ?? "sent";
}

/* ---------------------------------------------------------------- */
/* main                                                             */
/* ---------------------------------------------------------------- */

const args = process.argv.slice(2);
const provider = status();

if (args.includes("--status") || args.length === 0) {
  if (args.length === 0) {
    console.log("  Usage:  npm run mail:test -- you@example.com     (sends a real message)");
    console.log("          npm run mail:status                      (only reports configuration)");
  }
  process.exit(provider === "outbox" ? 1 : 0);
}

const to = args.find((a) => !a.startsWith("-"));
if (!to || !to.includes("@")) {
  console.error("Give the recipient address, e.g.  npm run mail:test -- you@example.com");
  process.exit(2);
}

if (provider === "outbox") {
  console.error("Nothing to send through: configure RESEND_API_KEY or SMTP_* first.");
  process.exit(1);
}

try {
  console.log(`Sending a real test message to ${to} via ${provider}…`);
  const result = provider === "resend" ? await sendWithResend(to) : await sendWithSmtp(to);
  console.log(`\n  ✓ Handed to ${provider}: ${result}`);
  console.log("    Check the inbox (and the spam folder) of that address now.\n");
} catch (error) {
  console.error(`\n  ✗ Failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
