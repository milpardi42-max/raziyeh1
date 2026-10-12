import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { seedContent } from "./seed";
import type { CollectionKey, SiteContent } from "../types";
import { rewriteLegacyMediaUrls } from "@/lib/media-storage";
import { RAZIEH_TEXTILE_CATEGORY, RAZIEH_TEXTILE_PORTFOLIO } from "./razieh-textile-portfolio";

/**
 * Content store with pluggable persistence — the UI never touches this directly.
 *
 *  1. Upstash Redis  (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  2. Local file     data/content.json
 *
 * The first configured backend wins. Admin edits go live immediately (all pages are dynamic).
 *
 * Concurrent-write protection:
 *   Every persisted document is wrapped in { etag, data }.
 *   `saveContent(next, expectedEtag?)` compares the supplied ETag atomically and
 *   throws "etag_conflict" when the stored document changed in the meantime.
 *   The file backend serializes writes and uses atomic rename; Redis uses Lua CAS.
 *   Callers that omit an ETag retain the legacy unconditional full-document-write behavior.
 */

const KEY = "rosie-atelier:content";
const FILE = path.join(process.cwd(), "data", "content.json");
const FILE_LOCK = `${FILE}.lock`;
const FILE_LOCK_WAIT_MS = 10_000;
const FILE_LOCK_STALE_MS = 5 * 60_000;
const RAZIEH_TEXTILE_MIGRATION = "razieh-textile-portfolio-v1";

/** Stable hash of a JSON string, used as the ETag. */
function makeEtag(json: string): string {
  return crypto.createHash("sha1").update(json).digest("hex").slice(0, 16);
}

function seedEtag(): string {
  return makeEtag(JSON.stringify(prepareContent(seedContent), null, 2));
}

function storedEtag(raw: string | null): string {
  if (!raw) return seedEtag();
  const json = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  try {
    const parsed: unknown = JSON.parse(json);
    return isEnvelope(parsed) ? parsed.etag : makeEtag(raw);
  } catch {
    // A corrupt/empty store is read as seed content; the matching seed ETag lets
    // an operator repair it with a conditional save instead of being locked out.
    return seedEtag();
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as NodeJS.ErrnoException).code === code;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFileContentLock<T>(operation: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const startedAt = Date.now();
  let lockHandle: Awaited<ReturnType<typeof fs.open>> | null = null;

  while (!lockHandle) {
    try {
      const candidate = await fs.open(FILE_LOCK, "wx");
      try {
        await candidate.writeFile(`${process.pid}:${Date.now()}`, "utf8");
        lockHandle = candidate;
      } catch (error) {
        await candidate.close();
        await fs.unlink(FILE_LOCK).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (!hasErrorCode(error, "EEXIST")) throw error;

      try {
        const [stat, owner] = await Promise.all([
          fs.stat(FILE_LOCK),
          fs.readFile(FILE_LOCK, "utf8").catch(() => ""),
        ]);
        const ownerPid = Number(owner.split(":", 1)[0]);
        let ownerIsAlive = false;
        if (Number.isInteger(ownerPid) && ownerPid > 0) {
          try {
            process.kill(ownerPid, 0);
            ownerIsAlive = true;
          } catch (error) {
            ownerIsAlive = (error as NodeJS.ErrnoException).code === "EPERM";
          }
        }
        if (!ownerIsAlive && Date.now() - stat.mtimeMs > FILE_LOCK_STALE_MS) {
          await fs.unlink(FILE_LOCK).catch(() => undefined);
          continue;
        }
      } catch (statError) {
        if (hasErrorCode(statError, "ENOENT")) continue;
        throw statError;
      }

      if (Date.now() - startedAt >= FILE_LOCK_WAIT_MS) {
        throw new Error("content_store_lock_timeout");
      }
      await wait(20 + Math.floor(Math.random() * 30));
    }
  }

  try {
    return await operation();
  } finally {
    await lockHandle.close().catch(() => undefined);
    await fs.unlink(FILE_LOCK).catch(() => undefined);
  }
}

/* ---------- backend: Upstash Redis (REST, no SDK) ---------- */
const redis = {
  enabled: () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  async cmd(args: string[]) {
    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    return (await r.json()) as { result: unknown };
  },
  async read() {
    const { result } = await this.cmd(["GET", KEY]);
    return typeof result === "string" ? result : null;
  },
  async write(json: string) {
    await this.cmd(["SET", KEY, json]);
  },
  async compareAndSet(previous: string | null, next: string) {
    const script = [
      "local current = redis.call('GET', KEYS[1])",
      "if (current or '') ~= ARGV[1] then return 0 end",
      "redis.call('SET', KEYS[1], ARGV[2])",
      "return 1",
    ].join("\n");
    const { result } = await this.cmd(["EVAL", script, "1", KEY, previous ?? "", next]);
    return Number(result) === 1;
  },
  async compareAndRemove(previous: string | null) {
    const script = [
      "local current = redis.call('GET', KEYS[1])",
      "if (current or '') ~= ARGV[1] then return 0 end",
      "redis.call('DEL', KEYS[1])",
      "return 1",
    ].join("\n");
    const { result } = await this.cmd(["EVAL", script, "1", KEY, previous ?? ""]);
    return Number(result) === 1;
  },
  async remove() {
    await this.cmd(["DEL", KEY]);
  },
};

/* ---------- backend: local file ---------- */
const file = {
  async read() {
    try {
      return await fs.readFile(FILE, "utf8");
    } catch {
      return null;
    }
  },
  async write(json: string) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const temporary = `${FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      await fs.writeFile(temporary, json, { encoding: "utf8", flag: "wx" });
      await fs.rename(temporary, FILE);
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
  },
  async remove() {
    try {
      await fs.unlink(FILE);
    } catch {
      /* nothing to reset */
    }
  },
};

function backend() {
  if (process.env.NODE_ENV !== "production") return file;
  if (redis.enabled()) return redis;
  return file;
}

export function storeBackendName(): "redis" | "file" {
  if (process.env.NODE_ENV !== "production") return "file";
  return redis.enabled() ? "redis" : "file";
}

/* ---------- persisted envelope ---------- */
interface Envelope {
  etag: string;
  data: Partial<SiteContent>;
}

function normalizeEventHosts(content: SiteContent): SiteContent {
  const academyHost = seedContent.artists.find((artist) => artist.id === "artist-razieh-khairipour");
  const replacePreviousHost = (value: { fa: string; en: string } | undefined) => ({
    fa: (value?.fa ?? "").replaceAll("نیلوفر راد", "راضیه خیری پور"),
    en: (value?.en ?? "").replaceAll("Niloufar Rad", "Razieh Khairipour"),
  });

  return {
    ...content,
    artists: academyHost && !content.artists.some((artist) => artist.id === academyHost.id)
      ? [...content.artists, academyHost]
      : content.artists,
    education: content.education.map((item) => {
      if (item.type !== "workshop" && item.type !== "webinar") return item;
      const liveEvent = item.liveEvent;
      if (!liveEvent) return item;
      const hasPreviousHost = liveEvent.hostName?.fa === "نیلوفر راد"
        || liveEvent.hostName?.en === "Niloufar Rad";
      const nextLiveEvent = hasPreviousHost || liveEvent.hostNameCustom === undefined
        ? {
            ...liveEvent,
            hostName: { fa: "راضیه خیری پور", en: "Razieh Khairipour" },
            hostNameCustom: true,
          }
        : liveEvent;
      return {
        ...item,
        authorId: item.authorId || "artist-razieh-khairipour",
        title: item.title ? replacePreviousHost(item.title) : { fa: "", en: "" },
        excerpt: replacePreviousHost(item.excerpt),
        body: replacePreviousHost(item.body),
        liveEvent: nextLiveEvent,
      };
    }),
  };
}

/** One-time additive migration for existing site content; saved marker prevents re-adding deleted work. */
function migrateRaziehTextilePortfolio(content: SiteContent): SiteContent {
  const migrations = content.siteMigrations ?? [];
  if (migrations.includes(RAZIEH_TEXTILE_MIGRATION)) return content;

  const hasPortfolio = content.portfolios.some((item) =>
    item.id === RAZIEH_TEXTILE_PORTFOLIO.id || item.slug === RAZIEH_TEXTILE_PORTFOLIO.slug,
  );
  const portfolioCategories = content.portfolioCategories ?? [];
  const hasCategory = portfolioCategories.some((item) => item.id === RAZIEH_TEXTILE_CATEGORY.id);
  const previousBio = "مدرس و میزبان ورکشاپ‌ها و وبینارهای آکادمی رزی.";
  const previousProfession = "مدرس و میزبان آکادمی";

  const artists = content.artists.map((artist) => {
    if (artist.id !== "artist-razieh-khairipour") return artist;
    const seedArtist = seedContent.artists.find((candidate) => candidate.id === artist.id);
    if (!seedArtist) return artist;
    const shouldUpdateBio = artist.bio.fa === previousBio || artist.bio.en === "Instructor and host of Rosie Academy workshops and webinars.";
    const shouldUpdateProfession = artist.profession.fa === previousProfession || artist.profession.en === "Academy instructor and host";
    if (!shouldUpdateBio && !shouldUpdateProfession) return artist;
    return {
      ...artist,
      ...(shouldUpdateBio ? { bio: seedArtist.bio } : {}),
      ...(shouldUpdateProfession ? { profession: seedArtist.profession } : {}),
      tags: [...new Set([...(artist.tags ?? []), "textile", "fabric", "colour", "vest-design"])],
    };
  });

  return {
    ...content,
    artists,
    portfolioCategories: hasCategory ? portfolioCategories : [...portfolioCategories, RAZIEH_TEXTILE_CATEGORY],
    portfolios: hasPortfolio ? content.portfolios : [...content.portfolios, RAZIEH_TEXTILE_PORTFOLIO],
    siteMigrations: [...migrations, RAZIEH_TEXTILE_MIGRATION],
  };
}

function prepareContent(content: SiteContent): SiteContent {
  return rewriteLegacyMediaUrls(migrateRaziehTextilePortfolio(normalizeEventHosts(content)));
}

function isEnvelope(v: unknown): v is Envelope {
  return typeof v === "object" && v !== null && "etag" in v && "data" in v;
}

function contentFromRaw(raw: string | null): [SiteContent, string] {
  try {
    if (!raw) return [prepareContent(seedContent), seedEtag()];
    // Strip UTF-8 BOM (0xFEFF) if present — some editors/tools prepend it.
    const json = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const parsed: unknown = JSON.parse(json);
    if (isEnvelope(parsed)) {
      return [prepareContent({ ...seedContent, ...parsed.data }), parsed.etag];
    }
    // Legacy plain JSON (no envelope) — migrate transparently.
    const content = { ...seedContent, ...(parsed as Partial<SiteContent>) };
    return [prepareContent(content), makeEtag(raw)];
  } catch {
    return [prepareContent(seedContent), seedEtag()];
  }
}

/* ---------- public API ---------- */

/** Returns [content, etag]. Seed content also receives a stable ETag so writes can be conditional. */
export async function getContentWithEtag(): Promise<[SiteContent, string]> {
  return contentFromRaw(await backend().read());
}

export async function getContent(): Promise<SiteContent> {
  const [content] = await getContentWithEtag();
  return content;
}

/**
 * Persist content.
 * @param next    Updated content to save.
 * @param expectedEtag  When provided, compare-and-replace atomically; a stale
 *                      version throws "etag_conflict" instead of losing an update.
 *                      Omit only when an unconditional full-document write is intended.
 * @returns The ETag of the saved document.
 */
export async function saveContent(next: SiteContent, expectedEtag?: string): Promise<string> {
  const dataJson = JSON.stringify(next, null, 2);
  const etag = makeEtag(dataJson);
  const serialized = JSON.stringify({ etag, data: next } satisfies Envelope);

  if (storeBackendName() === "file") {
    await withFileContentLock(async () => {
      const raw = await file.read();
      if (expectedEtag !== undefined && storedEtag(raw) !== expectedEtag) {
        throw new Error("etag_conflict");
      }
      await file.write(serialized);
    });
    return etag;
  }

  const raw = expectedEtag === undefined ? null : await redis.read();
  if (expectedEtag !== undefined) {
    if (storedEtag(raw) !== expectedEtag) throw new Error("etag_conflict");
    if (!(await redis.compareAndSet(raw, serialized))) throw new Error("etag_conflict");
  } else {
    await redis.write(serialized);
  }
  return etag;
}

export interface ContentMutationResult<T> {
  content: SiteContent;
  etag: string;
  result: T;
}

/**
 * Atomically mutate the shared content document.
 *
 * File-backed writes run the read/modify/write while holding the content lock.
 * Redis-backed writes retry the pure mutator after a failed compare-and-set.
 * Mutators must not perform external side effects because a Redis retry can
 * invoke them more than once.
 */
export async function mutateContent<T>(
  mutate: (current: SiteContent) => { content: SiteContent; result: T },
): Promise<ContentMutationResult<T>> {
  const persist = (next: SiteContent) => {
    const content = prepareContent(next);
    const etag = makeEtag(JSON.stringify(content, null, 2));
    return {
      content,
      etag,
      serialized: JSON.stringify({ etag, data: content } satisfies Envelope),
    };
  };

  if (storeBackendName() === "file") {
    return withFileContentLock(async () => {
      const [current] = contentFromRaw(await file.read());
      const mutation = mutate(current);
      const saved = persist(mutation.content);
      await file.write(saved.serialized);
      return { content: saved.content, etag: saved.etag, result: mutation.result };
    });
  }

  // Retry CAS conflicts so independent collection updates are applied to the
  // latest document instead of replacing one another with stale snapshots.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const raw = await redis.read();
    const [current] = contentFromRaw(raw);
    const mutation = mutate(current);
    const saved = persist(mutation.content);
    if (await redis.compareAndSet(raw, saved.serialized)) {
      return { content: saved.content, etag: saved.etag, result: mutation.result };
    }
  }

  throw new Error("etag_conflict");
}

export type CollectionUpdater<K extends CollectionKey> = (
  items: SiteContent[K],
  content: SiteContent,
) => SiteContent[K];

export interface CollectionMutationResult<K extends CollectionKey, T> {
  items: SiteContent[K];
  etag: string;
  result: T;
}

/** Mutate a collection against the latest document and return the mutation result. */
export async function mutateCollection<K extends CollectionKey, T>(
  key: K,
  mutate: (items: SiteContent[K], content: SiteContent) => { items: SiteContent[K]; result: T },
): Promise<CollectionMutationResult<K, T>> {
  const mutation = await mutateContent((current) => {
    const result = mutate(current[key], current);
    return {
      content: { ...current, [key]: result.items } as SiteContent,
      result: result.result,
    };
  });
  return {
    items: mutation.content[key],
    etag: mutation.etag,
    result: mutation.result,
  };
}

/**
 * Replace or atomically update one collection. Prefer an updater callback for
 * append/remove/item edits so concurrent changes to the same collection are
 * preserved. Returns the version written for callers that must refresh ETags.
 */
export async function updateCollection<K extends CollectionKey>(
  key: K,
  itemsOrUpdater: SiteContent[K] | CollectionUpdater<K>,
): Promise<string> {
  const mutation = await mutateCollection(key, (items, content) => ({
    items: typeof itemsOrUpdater === "function"
      ? (itemsOrUpdater as CollectionUpdater<K>)(items, content)
      : itemsOrUpdater,
    result: undefined,
  }));
  return mutation.etag;
}

export async function updateHero(hero: SiteContent["hero"]): Promise<string> {
  const { etag } = await mutateContent((current) => ({
    content: { ...current, hero },
    result: undefined,
  }));
  return etag;
}

export async function resetContent(expectedEtag?: string): Promise<string> {
  if (storeBackendName() === "file") {
    await withFileContentLock(async () => {
      const raw = await file.read();
      if (expectedEtag !== undefined && storedEtag(raw) !== expectedEtag) {
        throw new Error("etag_conflict");
      }
      await file.remove();
    });
    return seedEtag();
  }

  const raw = expectedEtag === undefined ? null : await redis.read();
  if (expectedEtag !== undefined) {
    if (storedEtag(raw) !== expectedEtag) throw new Error("etag_conflict");
    if (!(await redis.compareAndRemove(raw))) throw new Error("etag_conflict");
  } else {
    await redis.remove();
  }
  return seedEtag();
}
