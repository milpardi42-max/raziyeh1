import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { signPayload } from "@/lib/session";

/**
 * Password-less e-mail sign-in: a 6-digit code and a one-click magic link are
 * created together, both derived from one record per e-mail address.
 *
 * Storage follows the same dual-backend rule as the rest of the project:
 *  1. Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  2. Local file data/login-codes.json
 *
 * Security:
 *   • neither the code nor the link token is ever stored in clear — only their
 *     HMAC (keyed with AUTH_SECRET through session.signPayload) is persisted;
 *   • one record per address, replaced on every new request;
 *   • 60-second resend cooldown, 5 failed attempts, 10-minute expiry;
 *   • expiry is re-checked on read, so a stale file can never be replayed.
 */

export const LOGIN_CODE_LENGTH = 6;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const LOGIN_CODE_RESEND_COOLDOWN_MS = 60_000;

/** Configurable lifetime (EMAIL_LOGIN_TTL_MINUTES), clamped to a sane range. */
export const LOGIN_CODE_TTL_MS = (() => {
  const minutes = Number(process.env.EMAIL_LOGIN_TTL_MINUTES ?? 10);
  const safe = Number.isFinite(minutes) ? Math.min(60, Math.max(2, Math.round(minutes))) : 10;
  return safe * 60_000;
})();

export interface LoginCodeRecord {
  email: string;
  codeHash: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  /**
   * Which form asked for the code — used to decide what happens after a
   * successful verification on the magic-link route (which has no JS context).
   */
  entry: "login" | "signup";
  /**
   * Role chosen on the signup form ("artist" asks for a seller profile).
   * Only ever honoured while the entry page is "signup"; a login code can never
   * change an existing account's role.
   */
  role: "user" | "artist";
  locale: "fa" | "en";
  returnTo: string;
  consumedAt?: string;
}

/* ---------- backend ---------- */
const REDIS_KEY = "rosie-atelier:login-codes";
const FILE_PATH = path.join(process.cwd(), "data", "login-codes.json");

function redisEnabled(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCmd(args: string[]): Promise<{ result: unknown }> {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()) as { result: unknown };
}

async function readAll(): Promise<LoginCodeRecord[]> {
  try {
    if (redisEnabled()) {
      const { result } = await redisCmd(["GET", REDIS_KEY]);
      return typeof result === "string" ? (JSON.parse(result) as LoginCodeRecord[]) : [];
    }
    const raw = await fs.readFile(FILE_PATH, "utf8");
    return JSON.parse(raw) as LoginCodeRecord[];
  } catch {
    return [];
  }
}

async function writeAll(records: LoginCodeRecord[]): Promise<void> {
  if (redisEnabled()) {
    await redisCmd(["SET", REDIS_KEY, JSON.stringify(records)]);
    return;
  }
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(records, null, 2), "utf8");
}

/** Drops consumed/expired records so the file cannot grow without bound. */
function prune(records: LoginCodeRecord[], now: number): LoginCodeRecord[] {
  return records.filter((record) => {
    if (record.consumedAt) return false;
    const expires = new Date(record.expiresAt).getTime();
    return Number.isFinite(expires) && expires > now - 60_000;
  });
}

/* ---------- crypto helpers ---------- */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}

async function hashValue(kind: "code" | "token", email: string, value: string): Promise<string> {
  return signPayload(`${kind}:${email}:${value}`);
}

function randomCode(): string {
  return String(crypto.randomInt(0, 10 ** LOGIN_CODE_LENGTH)).padStart(LOGIN_CODE_LENGTH, "0");
}

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/* ---------- public API ---------- */

export interface RequestCodeInput {
  email: string;
  locale: "fa" | "en";
  entry: "login" | "signup";
  returnTo: string;
  /** Role requested on the signup form; ignored for "login" entries. */
  role?: "user" | "artist";
}

export type RequestCodeResult =
  | { ok: true; code: string; token: string; expiresAt: string }
  | { ok: false; error: "cooldown"; retryAfterS: number };

/**
 * Creates (or replaces) the record for an address and returns the clear-text
 * code + link token so the caller can put them in the e-mail. Callers must
 * never return these values over the network in production.
 */
export async function createLoginCode(input: RequestCodeInput): Promise<RequestCodeResult> {
  const email = normaliseEmail(input.email);
  const now = Date.now();
  const records = prune(await readAll(), now);
  const existing = records.find((record) => record.email === email);

  if (existing) {
    const sentAt = new Date(existing.createdAt).getTime();
    const elapsed = now - sentAt;
    if (Number.isFinite(sentAt) && elapsed < LOGIN_CODE_RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: "cooldown",
        retryAfterS: Math.max(1, Math.ceil((LOGIN_CODE_RESEND_COOLDOWN_MS - elapsed) / 1000)),
      };
    }
  }

  const code = randomCode();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + LOGIN_CODE_TTL_MS).toISOString();

  const record: LoginCodeRecord = {
    email,
    codeHash: await hashValue("code", email, code),
    tokenHash: await hashValue("token", email, token),
    createdAt: new Date(now).toISOString(),
    expiresAt,
    attempts: 0,
    entry: input.entry,
    role: input.entry === "signup" && input.role === "artist" ? "artist" : "user",
    locale: input.locale,
    returnTo: input.returnTo.slice(0, 300),
  };

  await writeAll([...records.filter((item) => item.email !== email), record]);
  return { ok: true, code, token, expiresAt };
}

export type VerifyCodeResult =
  | { ok: true; role: "user" | "artist"; entry: "login" | "signup"; locale: "fa" | "en" }
  | { ok: false; error: "not_found" | "expired" | "invalid" | "too_many_attempts" };

export async function verifyLoginCode(emailInput: string, codeInput: string): Promise<VerifyCodeResult> {
  const email = normaliseEmail(emailInput);
  const code = codeInput.replace(/\D/g, "").slice(0, LOGIN_CODE_LENGTH);
  const now = Date.now();

  const records = await readAll();
  const record = records.find((item) => item.email === email);
  if (!record || record.consumedAt) return { ok: false, error: "not_found" };

  if (new Date(record.expiresAt).getTime() <= now) {
    await writeAll(prune(records, now));
    return { ok: false, error: "expired" };
  }
  if (record.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
    await writeAll(records.filter((item) => item.email !== email));
    return { ok: false, error: "too_many_attempts" };
  }

  const expected = await hashValue("code", email, code);
  if (!timingSafeMatch(expected, record.codeHash)) {
    record.attempts += 1;
    await writeAll(records.map((item) => (item.email === email ? record : item)));
    return { ok: false, error: record.attempts >= LOGIN_CODE_MAX_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }

  record.consumedAt = new Date(now).toISOString();
  await writeAll(records.map((item) => (item.email === email ? record : item)));
  return { ok: true, role: record.role ?? "user", entry: record.entry, locale: record.locale };
}

export type VerifyTokenResult =
  | {
      ok: true;
      email: string;
      locale: "fa" | "en";
      entry: "login" | "signup";
      role: "user" | "artist";
      returnTo: string;
    }
  | { ok: false; error: "invalid" | "expired" };

/**
 * Verifies a magic-link token. The token alone cannot be guessed, so the e-mail
 * address is not needed as a second factor; it is recovered from the stored
 * record whose token hash matches.
 */
export async function verifyLoginToken(tokenInput: string): Promise<VerifyTokenResult> {
  const token = tokenInput.trim();
  if (!token || token.length < 20) return { ok: false, error: "invalid" };

  const now = Date.now();
  const records = await readAll();
  const active = prune(records, now);

  for (const record of active) {
    const expected = await hashValue("token", record.email, token);
    if (!timingSafeMatch(expected, record.tokenHash)) continue;

    if (new Date(record.expiresAt).getTime() <= now) {
      await writeAll(active);
      return { ok: false, error: "expired" };
    }

    record.consumedAt = new Date(now).toISOString();
    await writeAll(records.map((item) => (item.email === record.email ? record : item)));
    return {
      ok: true,
      email: record.email,
      locale: record.locale,
      entry: record.entry,
      role: record.role ?? "user",
      returnTo: record.returnTo,
    };
  }

  return { ok: false, error: "invalid" };
}
