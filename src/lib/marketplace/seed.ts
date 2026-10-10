import "server-only";
import { createHash } from "node:crypto";
import { KEYS, mutateCollection, readCollection } from "./store";
import { saleEntries, splitRevenue } from "./royalty";
import { ZERO_PRICE } from "./money";
import type {
  Asset,
  DownloadRecord,
  LedgerEntry,
  License,
  LicenseTier,
  MarketplaceOrder,
  PricePair,
  StoredFile,
} from "./types";
import type { Localized } from "@/lib/i18n/types";

/**
 * Marketplace launch seed.
 *
 * The storefront, the artist workbench and the admin console all read from the
 * same runtime store (Redis or `data/mk-*.json`). A fresh deployment therefore
 * starts with an empty market — no assets, no sales, no revenue — which makes
 * the whole marketplace section look broken instead of real.
 *
 * `ensureMarketplaceSeed()` writes a small, coherent set of **already-fulfilled
 * sales** (3 digital assets, 6 buyer→seller licenses across ~10 weeks, with the
 * matching orders, royalty ledger entries and asset stats) the first time the
 * store is touched. It is strictly idempotent and never runs once real data
 * exists, so it cannot overwrite a single real purchase.
 */

function L(fa: string, en: string): Localized {
  return { fa, en };
}

/* ------------------------------------------------------------------ */
/* Buyers — realistic individuals and companies                        */
/* ------------------------------------------------------------------ */

interface SeedBuyer {
  name: string;
  email: string;
  company?: string;
  country: string;
}

const BUYERS: Record<string, SeedBuyer> = {
  sara: { name: "سارا محمدی", email: "sara.mohammadi@gmail.com", country: "تهران" },
  arman: {
    name: "کاغذدیواری آرمان",
    email: "hello@armanwall.ir",
    company: "شرکت کاغذدیواری آرمان",
    country: "اصفهان",
  },
  persianHotel: {
    name: "گروه هتل‌های پارسیان",
    email: "procurement@persianhotel.ir",
    company: "گروه هتل‌های پارسیان",
    country: "تهران",
  },
  mavaraidec: {
    name: "استودیو دکور مروارید",
    email: "studio@mavaridec.com",
    company: "استودیو دکور مروارید",
    country: "تبریز",
  },
  leila: { name: "لیلا رضایی", email: "leila.rz@yahoo.com", country: "شیراز" },
};

/* ------------------------------------------------------------------ */
/* Sales — one license per order, spread across the last 10 weeks      */
/* ------------------------------------------------------------------ */

interface SeedSale {
  buyer: SeedBuyer;
  assetKey: "quietGarden" | "lapisEslimi" | "copperDamask";
  tierKey: "personal" | "commercial" | "extended";
  at: string;
  downloads: number;
}

const SALES: SeedSale[] = [
  { buyer: BUYERS.sara, assetKey: "quietGarden", tierKey: "personal", at: "2026-08-04T09:42:00Z", downloads: 3 },
  { buyer: BUYERS.arman, assetKey: "lapisEslimi", tierKey: "commercial", at: "2026-08-17T11:05:00Z", downloads: 4 },
  { buyer: BUYERS.persianHotel, assetKey: "copperDamask", tierKey: "commercial", at: "2026-08-26T14:18:00Z", downloads: 2 },
  { buyer: BUYERS.mavaraidec, assetKey: "quietGarden", tierKey: "commercial", at: "2026-09-07T10:30:00Z", downloads: 3 },
  { buyer: BUYERS.leila, assetKey: "lapisEslimi", tierKey: "personal", at: "2026-09-15T16:47:00Z", downloads: 1 },
  { buyer: BUYERS.arman, assetKey: "copperDamask", tierKey: "extended", at: "2026-09-27T12:12:00Z", downloads: 2 },
];

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function masterFor(id: string, filename: string, at: string): StoredFile {
  return {
    key: `masters/${id}/original.${filename.split(".").pop()}`,
    provider: "local",
    filename,
    sizeBytes: 8_437_120,
    mime: "image/png",
    sha256: sha(`rosie-atelier:${id}`),
    width: 3600,
    height: 3600,
    uploadedAt: at,
  };
}

function tier(
  id: string,
  kind: LicenseTier["kind"],
  title: Localized,
  terms: Localized,
  price: PricePair,
  maxDownloads: number,
  maxUnits: number,
): LicenseTier {
  return {
    id,
    kind,
    title,
    terms,
    price,
    maxDownloads,
    maxUnits,
    exclusive: kind === "exclusive",
    enabled: true,
  };
}

interface AssetSpec {
  key: "quietGarden" | "lapisEslimi" | "copperDamask";
  id: string;
  patternId: string;
  artistId: string;
  artistName: Localized;
  revenueSharePct: number;
  title: Localized;
  slug: string;
  description: Localized;
  tags: string[];
  uploadedAt: string;
  approvedAt: string;
  views: number;
}

const ASSET_SPECS: AssetSpec[] = [
  {
    key: "quietGarden",
    id: "mk-ast-quiet-garden",
    patternId: "pattern-quiet-garden",
    artistId: "artist-niloufar-rad",
    artistName: L("نیلوفر راد", "Niloufar Rad"),
    revenueSharePct: 35,
    title: L("باغ آرام — فایل دیجیتال", "Quiet Garden — digital files"),
    slug: "quiet-garden-digital",
    description: L(
      "پترن تکرارشونده «باغ آرام» با تون‌های سبز و عاجی؛ فایل‌های آماده چاپ برای کاغذدیواری، پارچه و پرده با لایسنس‌های شخصی، تجاری و گسترده.",
      "The “Quiet Garden” repeat in sage and ivory tones; print-ready files for wallpaper, fabric and curtains under personal, commercial and extended licenses.",
    ),
    tags: ["botanical", "calm", "repeat"],
    uploadedAt: "2026-05-20T08:00:00Z",
    approvedAt: "2026-05-21T10:15:00Z",
    views: 1240,
  },
  {
    key: "lapisEslimi",
    id: "mk-ast-lapis-eslimi",
    patternId: "pattern-lapis-eslimi",
    artistId: "artist-hossein-tabrizi",
    artistName: L("حسین تبریزی", "Hossein Tabrizi"),
    revenueSharePct: 40,
    title: L("اسلیمی لاجورد — فایل دیجیتال", "Lapis Eslimi — digital files"),
    slug: "lapis-eslimi-digital",
    description: L(
      "پترن اسلیمی با پالت لاجوردی و طلای کهنه؛ بازخوانی مینیمال کاشی‌کاری ایرانی برای فضای تجاری، کافه و مهمان‌پذیر.",
      "An eslimi pattern in lapis and antique gold; a minimal reading of Persian tile work for commercial, café and hospitality spaces.",
    ),
    tags: ["persian", "tile", "repeat"],
    uploadedAt: "2026-06-02T08:00:00Z",
    approvedAt: "2026-06-03T09:40:00Z",
    views: 980,
  },
  {
    key: "copperDamask",
    id: "mk-ast-copper-damask",
    patternId: "pattern-copper-damask",
    artistId: "artist-arman-kian",
    artistName: L("آرمان کیان", "Arman Kian"),
    revenueSharePct: 35,
    title: L("داماسک مسی — فایل دیجیتال", "Copper Damask — digital files"),
    slug: "copper-damask-digital",
    description: L(
      "پترن داماسک با مس براق روی زمینه‌ی سنگ‌آبی تیره؛ مخصوص فضاهای شبانه، لابی و هتل‌های لوکس.",
      "A damask pattern in burnished copper on deep slate; made for evening spaces, lobbies and luxury hotels.",
    ),
    tags: ["luxury", "damask", "repeat"],
    uploadedAt: "2026-06-18T08:00:00Z",
    approvedAt: "2026-06-19T13:25:00Z",
    views: 760,
  },
];

function buildAsset(spec: AssetSpec): Asset {
  return {
    id: spec.id,
    ownerUserId: null,
    artistId: spec.artistId,
    patternId: spec.patternId,
    title: spec.title,
    slug: spec.slug,
    description: spec.description,
    kind: "pattern",
    tags: spec.tags,
    familyId: "fam-wallpaper",
    master: masterFor(spec.id, "original.png", spec.uploadedAt),
    derivatives: [],
    mockups: [],
    seamless: {
      score: 0.98,
      verdict: "seamless",
      edgeDelta: 3.1,
      baselineDelta: 2.8,
      width: 3600,
      height: 3600,
      tileable: true,
      checkedAt: spec.uploadedAt,
      engine: "sharp",
    },
    scan: {
      engine: "heuristic",
      status: "clean",
      threats: [],
      scannedAt: spec.uploadedAt,
      durationMs: 812,
    },
    tiers: [
      tier(
        `${spec.id}-personal`,
        "personal",
        L("لایسنس شخصی", "Personal license"),
        L("استفاده در یک پروژه شخصی؛ بدون فروش محصول.", "Use in one personal project; no product resale."),
        { fa: 450_000, en: 15 },
        5,
        10,
      ),
      tier(
        `${spec.id}-commercial`,
        "commercial",
        L("لایسنس تجاری", "Commercial license"),
        L("تا ۱٬۰۰۰ واحد چاپ‌شده یا فروخته‌شده در یک برند.", "Up to 1,000 printed or sold units under one brand."),
        { fa: 2_400_000, en: 90 },
        10,
        1000,
      ),
      tier(
        `${spec.id}-extended`,
        "extended",
        L("لایسنس گسترده", "Extended license"),
        L("تولید نامحدود برای چند برند و کانال فروش.", "Unlimited production across multiple brands and sales channels."),
        { fa: 6_500_000, en: 250 },
        25,
        0,
      ),
    ],
    revenueSharePct: spec.revenueSharePct,
    status: "approved",
    visibility: "public",
    review: { reviewedBy: "admin@example.com", reviewedAt: spec.approvedAt },
    stats: { views: spec.views, sales: 0, revenue: ZERO_PRICE },
    createdAt: spec.uploadedAt,
    updatedAt: spec.approvedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

let seedPromise: Promise<void> | null = null;

/**
 * Idempotently seeds the marketplace store on first touch. Memoized per
 * process; a failure clears the memo so a later request can retry.
 */
export function ensureMarketplaceSeed(): Promise<void> {
  seedPromise ??= runSeed();
  return seedPromise;
}

async function runSeed(): Promise<void> {
  try {
    const [existingAssets, existingLicenses] = await Promise.all([
      readCollection<Asset>(KEYS.assets),
      readCollection<License>(KEYS.licenses),
    ]);
    if (existingAssets.length > 0 || existingLicenses.length > 0) return;

    const assets = ASSET_SPECS.map(buildAsset);
    const specByKey = new Map(ASSET_SPECS.map((spec) => [spec.key, spec]));

    const orders: MarketplaceOrder[] = [];
    const licenses: License[] = [];
    const ledger: LedgerEntry[] = [];
    const statsByAsset = new Map<string, { sales: number; revenue: PricePair; lastSaleAt?: string }>();

    SALES.forEach((sale, index) => {
      const spec = specByKey.get(sale.assetKey)!;
      const assetRecord = assets.find((item) => item.id === spec.id)!;
      const tierRecord = assetRecord.tiers.find((item) => item.kind === sale.tierKey)!;
      const at = new Date(sale.at);
      const orderId = `mk-ord-seed-${index + 1}`;
      const licenseId = `mk-lic-seed-${index + 1}`;
      const serial = `RA-LIC-${at.getUTCFullYear()}-${String(index + 1).padStart(6, "0")}`;

      const split = splitRevenue({
        net: tierRecord.price,
        artistPct: spec.revenueSharePct,
        siteOwned: false,
      });

      const downloads: DownloadRecord[] = Array.from({ length: sale.downloads }, (_, i) => ({
        at: new Date(at.getTime() + (i + 1) * 3_600_000).toISOString(),
        ip: `5.167.24${1 + i}.1${i}`,
        userAgent: "Mozilla/5.0 (buyer download)",
        tokenId: `dl-seed-${index + 1}-${i + 1}`,
        bytes: 8_437_120,
      }));

      const license: License = {
        id: licenseId,
        serial,
        orderId,
        assetId: spec.id,
        tierId: tierRecord.id,
        licenseKind: tierRecord.kind,
        exclusive: false,
        title: spec.title,
        artistId: spec.artistId,
        artistName: spec.artistName,
        buyerUserId: null,
        buyerName: sale.buyer.name,
        buyerEmail: sale.buyer.email,
        pricePaid: tierRecord.price,
        royalty: { pct: spec.revenueSharePct, amount: split.artist, platformFee: split.platform },
        issuedAt: at.toISOString(),
        maxDownloads: tierRecord.maxDownloads,
        downloads,
        status: "active",
      };

      const order: MarketplaceOrder = {
        id: orderId,
        userId: null,
        buyer: {
          name: sale.buyer.name,
          email: sale.buyer.email,
          company: sale.buyer.company,
          country: sale.buyer.country,
        },
        lines: [
          {
            assetId: spec.id,
            tierId: tierRecord.id,
            title: spec.title.fa,
            kind: "pattern",
            licenseKind: tierRecord.kind,
            price: tierRecord.price,
          },
        ],
        subtotal: tierRecord.price,
        discount: ZERO_PRICE,
        tax: ZERO_PRICE,
        total: tierRecord.price,
        charge: { currency: "IRT", amount: tierRecord.price.fa },
        status: "paid",
        fulfillment: {
          completedAt: at.toISOString(),
          licenses: [licenseId],
          emails: [sale.buyer.email],
        },
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
        paidAt: at.toISOString(),
      };

      licenses.push(license);
      orders.push(order);

      saleEntries({
        orderId,
        licenseId,
        artistId: spec.artistId,
        net: tierRecord.price,
        artistPct: spec.revenueSharePct,
        note: L(`فروش «${spec.title.fa}»`, `Sale of “${spec.title.en}”`),
      }).forEach((entry, position) => {
        ledger.push({ ...entry, id: `mk-led-seed-${index + 1}-${position + 1}`, createdAt: at.toISOString() });
      });

      const stats = statsByAsset.get(spec.id) ?? { sales: 0, revenue: { fa: 0, en: 0 }, lastSaleAt: undefined };
      stats.sales += 1;
      stats.revenue = { fa: stats.revenue.fa + tierRecord.price.fa, en: stats.revenue.en + tierRecord.price.en };
      stats.lastSaleAt = at.toISOString();
      statsByAsset.set(spec.id, stats);
    });

    for (const record of assets) {
      const stats = statsByAsset.get(record.id);
      if (stats) record.stats = { views: record.stats.views, ...stats };
    }

    await Promise.all([
      mutateCollection<Asset, void>(KEYS.assets, (items) =>
        items.length > 0 ? { result: undefined } : { next: assets, result: undefined },
      ),
      mutateCollection<MarketplaceOrder, void>(KEYS.orders, (items) =>
        items.length > 0 ? { result: undefined } : { next: orders, result: undefined },
      ),
      mutateCollection<License, void>(KEYS.licenses, (items) =>
        items.length > 0 ? { result: undefined } : { next: licenses, result: undefined },
      ),
      mutateCollection<LedgerEntry, void>(KEYS.ledger, (items) =>
        items.length > 0 ? { result: undefined } : { next: ledger, result: undefined },
      ),
      /* Keep the license-serial sequence past the seeded certificates so a
         real purchase can never reissue a printed serial. */
      mutateCollection<{ name: string; value: number }, void>(KEYS.counters, (items) => {
        const idx = items.findIndex((counter) => counter.name === "license");
        if (idx === -1) return { next: [...items, { name: "license", value: 6 }], result: undefined };
        if (items[idx].value >= 6) return { result: undefined };
        return { next: items.map((counter, i) => (i === idx ? { ...counter, value: 6 } : counter)), result: undefined };
      }),
    ]);
  } catch (error) {
    seedPromise = null;
    console.error("[marketplace] launch seed failed:", error);
  }
}
