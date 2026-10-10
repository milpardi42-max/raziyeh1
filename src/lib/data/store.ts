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
 *   `saveContent(next, expectedEtag?)` will throw "etag_conflict" if the stored
 *   etag differs from the expected one, preventing a lost-update.
 *   Callers that don't pass an etag (e.g. admin full-replace) always win.
 */

const KEY = "rosie-atelier:content";
const FILE = path.join(process.cwd(), "data", "content.json");
const RAZIEH_TEXTILE_MIGRATION = "razieh-textile-portfolio-v1";

/** Stable hash of a JSON string, used as the ETag. */
function makeEtag(json: string): string {
  return crypto.createHash("sha1").update(json).digest("hex").slice(0, 16);
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
    await fs.writeFile(FILE, json, "utf8");
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

/* ---------- public API ---------- */

/** Returns [content, etag]. etag is empty string when content came from seed. */
export async function getContentWithEtag(): Promise<[SiteContent, string]> {
  try {
    const raw = await backend().read();
    if (!raw) return [prepareContent(seedContent), ""];
    // Strip UTF-8 BOM (0xFEFF) if present — some editors/tools prepend it
    const json = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const parsed: unknown = JSON.parse(json);
    if (isEnvelope(parsed)) {
      return [prepareContent({ ...seedContent, ...parsed.data }), parsed.etag];
    }
    // Legacy plain JSON (no envelope) — migrate transparently
    const content = { ...seedContent, ...(parsed as Partial<SiteContent>) };
    return [prepareContent(content), makeEtag(raw)];
  } catch {
    return [prepareContent(seedContent), ""];
  }
}

export async function getContent(): Promise<SiteContent> {
  const [content] = await getContentWithEtag();
  return content;
}

/**
 * Persist content.
 * @param next    Updated content to save.
 * @param expectedEtag  When provided, the save will throw "etag_conflict" if the
 *                      stored etag differs from the expected one (optimistic locking).
 *                      Omit to force-save (admin full-replace).
 */
export async function saveContent(next: SiteContent, expectedEtag?: string): Promise<void> {
  if (expectedEtag !== undefined) {
    const [, currentEtag] = await getContentWithEtag();
    if (currentEtag !== expectedEtag) {
      throw new Error("etag_conflict");
    }
  }
  const dataJson = JSON.stringify(next, null, 2);
  const etag = makeEtag(dataJson);
  const envelope: Envelope = { etag, data: next };
  await backend().write(JSON.stringify(envelope));
}

export async function updateCollection<K extends CollectionKey>(key: K, items: SiteContent[K]) {
  const current = await getContent();
  await saveContent({ ...current, [key]: items });
}

export async function updateHero(hero: SiteContent["hero"]) {
  const current = await getContent();
  await saveContent({ ...current, hero });
}

export async function resetContent() {
  await backend().remove();
}
