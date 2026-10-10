import { artistPortfolioWorks } from "@/lib/artist/portfolio";
import { getPortfolioCategories } from "@/lib/portfolio-categories";
import type { Artist, CourseVideoFile, EducationItem, LiveEventConfig, Pattern, Portfolio, Product, SiteContent } from "../types";
import { effectiveLiveStatus } from "../academy-live";

export type Enriched<T> = T & { artist: Artist | null };

export function artistOf(site: SiteContent, id: string | null): Artist | null {
  if (!id) return null;
  return site.artists.find((a) => a.id === id) ?? null;
}
export function categoryOf(site: SiteContent, id: string) {
  return site.categories.find((c) => c.id === id) ?? null;
}
export function patternById(site: SiteContent, id: string) {
  return site.patterns.find((p) => p.id === id) ?? null;
}
export function productById(site: SiteContent, id: string) {
  return site.products.find((p) => p.id === id) ?? null;
}

const ACADEMY_HOST: Artist = {
  id: "artist-razieh-khairipour",
  slug: "razieh-khairipour",
  name: { fa: "راضیه خیری پور", en: "Razieh Khairipour" },
  profession: { fa: "مدرس و میزبان آکادمی", en: "Academy instructor and host" },
  bio: { fa: "مدرس و میزبان ورکشاپ‌ها و وبینارهای آکادمی آتلیه رزی.", en: "Instructor and host of Rosie Atelier Academy workshops and webinars." },
  avatar: "/images/education/e01.jpg",
  cover: "/images/education/e01.jpg",
  location: { fa: "تهران", en: "Tehran" },
  social: {},
  featured: false,
  followers: 0,
  rating: 5,
  reviewsCount: 0,
};
export function portfolioById(site: SiteContent, id: string) {
  return site.portfolios.find((p) => p.id === id) ?? null;
}

export function enrichPattern(site: SiteContent, p: Pattern) {
  return { ...p, artist: artistOf(site, p.artistId), category: categoryOf(site, p.categoryId) };
}
export function enrichProduct(site: SiteContent, p: Product) {
  return { ...p, artist: artistOf(site, p.artistId), category: categoryOf(site, p.categoryId), pattern: p.patternId ? patternById(site, p.patternId) : null };
}
export function enrichPortfolio(site: SiteContent, p: Portfolio) {
  return {
    ...p,
    artist: artistOf(site, p.artistId),
    category: getPortfolioCategories(site).find((category) => category.id === p.categoryId) ?? categoryOf(site, p.categoryId),
    patterns: p.patternIds.map((id) => patternById(site, id)).filter(Boolean) as Pattern[],
    products: p.productIds.map((id) => productById(site, id)).filter(Boolean) as Product[],
  };
}
function publicVideoFile(video: CourseVideoFile): Omit<CourseVideoFile, "storageKey"> {
  const safe = { ...video };
  delete safe.storageKey;
  return { ...safe, url: `/api/academy/videos/${encodeURIComponent(video.id)}` };
}

function publicLiveEvent(event: LiveEventConfig | undefined): Omit<LiveEventConfig, "meetLink" | "recordingUrl" | "recordingDownloadable" | "recordingPublic" | "webinarStream"> | undefined {
  if (!event) return undefined;
  const safe = { ...event };
  delete safe.meetLink;
  delete safe.recordingUrl;
  delete safe.recordingDownloadable;
  delete safe.recordingPublic;
  delete safe.webinarStream;
  return { ...safe, status: effectiveLiveStatus(event) ?? event.status };
}

function resolvePerson(
  site: SiteContent,
  cfg: {
    custom?: boolean;
    selectedId?: string;
    customName?: string;
    photoUrl?: string;
    /** legacy Localized hostName */
    legacyName?: { fa?: string; en?: string } | null;
    legacyEnabled?: boolean;
  },
  fallbackArtist?: Artist,
): { name: string; photo?: string; artist: Artist | null } {
  if (cfg.custom) {
    const name = (cfg.customName || cfg.legacyName?.fa || "").trim();
    return { name, photo: cfg.photoUrl || undefined, artist: null };
  }
  const id = cfg.selectedId;
  const artist = id ? site.artists.find((a) => a.id === id) : fallbackArtist;
  if (artist) return { name: artist.name.fa, photo: artist.avatar, artist };
  const fallbackName = cfg.legacyEnabled && cfg.legacyName?.fa ? cfg.legacyName.fa : "";
  return { name: fallbackName, photo: cfg.photoUrl || undefined, artist: null };
}

export function enrichEducation(site: SiteContent, e: EducationItem) {
  const defaultArtistRaw = e.type === "workshop" || e.type === "webinar"
    ? site.artists.find((artist) => artist.id === "artist-razieh-khairipour") ?? ACADEMY_HOST
    : artistOf(site, e.authorId);
  const defaultArtist: Artist | undefined = defaultArtistRaw ?? undefined;

  const live = e.liveEvent;
  const instructor = live
    ? resolvePerson(
        site,
        {
          custom: !!live.instructorNameCustom,
          selectedId: live.instructorId,
          customName: live.instructorName,
          photoUrl: live.instructorPhoto,
          legacyName: live.hostName,
          legacyEnabled: live.hostNameCustom,
        },
        defaultArtist,
      )
    : null;

  const host = live
    ? resolvePerson(
        site,
        {
          custom: !!live.hostCustom,
          selectedId: live.hostId,
          customName: live.hostNameFa,
          photoUrl: live.hostPhoto,
        },
      )
    : null;

  // For backward compatibility, compute author display name using new instructor info when available.
  const author: Artist | null = (() => {
    if (e.type === "course") return defaultArtist ?? null;
    if (instructor?.artist) return instructor.artist;
    return defaultArtist ?? null;
  })();

  return {
    ...e,
    videoFiles: e.videoFiles?.map(publicVideoFile),
    liveEvent: publicLiveEvent(e.liveEvent),
    author,
    instructor,
    host,
    category: categoryOf(site, e.categoryId),
    patterns: e.patternIds.map((id) => patternById(site, id)).filter(Boolean) as Pattern[],
    products: e.productIds.map((id) => productById(site, id)).filter(Boolean) as Product[],
  };
}

export function artistStats(site: SiteContent, artistId: string) {
  return {
    patterns: site.patterns.filter((p) => p.artistId === artistId),
    products: site.products.filter((p) => p.artistId === artistId),
    portfolios: artistPortfolioWorks(site.portfolios, artistId),
    education: site.education.filter((e) => e.authorId === artistId),
  };
}

export type EnrichedPattern = ReturnType<typeof enrichPattern>;
export type EnrichedProduct = ReturnType<typeof enrichProduct>;
export type EnrichedPortfolio = ReturnType<typeof enrichPortfolio>;
export type EnrichedEducation = ReturnType<typeof enrichEducation>;
