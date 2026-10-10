"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useLocale } from "@/components/providers/AppProviders";
import { ArtistCard, type ArtistCardData } from "@/components/cards/ArtistCard";
import { cn, formatNumber, href, t } from "@/lib/utils";

type Discipline = "all" | "pattern" | "patina" | "illustration" | "canvas";
const disciplines: {
  id: Discipline;
  fa: string;
  en: string;
  terms: string[];
}[] = [
  { id: "all", fa: "همهٔ طراحان", en: "All designers", terms: [] },
  {
    id: "pattern",
    fa: "پترن و سطح",
    en: "Pattern & surface",
    terms: [
      "pattern",
      "surface",
      "geometric",
      "botanical",
      "floral",
      "پترن",
      "پترن",
      "کاغذدیواری",
    ],
  },
  {
    id: "patina",
    fa: "پتینه و بافت",
    en: "Patina & finishes",
    terms: ["patina", "پتینه"],
  },
  {
    id: "illustration",
    fa: "تصویرسازی",
    en: "Illustration",
    terms: ["illustration", "illustrator", "kids", "تصویرگر", "تصویرسازی"],
  },
  {
    id: "canvas",
    fa: "نقاشی و دیوارنگاری",
    en: "Painting & murals",
    terms: ["canvas", "mural", "نقاش", "دیوارنگار"],
  },
];
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("ي", "ی")
    .replaceAll("ك", "ک")
    .replace(/\u200c/g, " ")
    .trim();

export function ArtistsHubView({
  artists,
  heroImage,
}: {
  artists: ArtistCardData[];
  heroImage: string;
}) {
  const { locale } = useLocale();
  const fa = locale === "fa";
  const [discipline, setDiscipline] = useState<Discipline>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("directory");
  const [commissions, setCommissions] = useState(false);
  const filtered = useMemo(() => {
    const terms = disciplines.find((d) => d.id === discipline)!.terms;
    return artists
      .filter((artist) => {
        const specialty = normalize(
          [
            artist.profession.fa,
            artist.profession.en,
            ...(artist.tags ?? []),
            ...(artist.services ?? [])
              .filter((s) => s.active !== false)
              .map((s) => s.category),
          ].join(" "),
        );
        if (terms.length && !terms.some((term) => specialty.includes(term)))
          return false;
        if (commissions && !artist.acceptsCommissions) return false;
        const text = normalize(
          [
            specialty,
            artist.name.fa,
            artist.name.en,
            artist.location.fa,
            artist.location.en,
          ].join(" "),
        );
        return text.includes(normalize(query));
      })
      .sort((a, b) =>
        sort === "works"
          ? b.counts.projects - a.counts.projects
          : sort === "name"
            ? t(a.name, locale).localeCompare(
                t(b.name, locale),
                fa ? "fa" : "en",
              )
            : 0,
      );
  }, [artists, discipline, query, commissions, sort, locale, fa]);
  const reset = () => {
    setQuery("");
    setDiscipline("all");
    setCommissions(false);
    setSort("directory");
  };
  const hasFilters = query || discipline !== "all" || commissions;

  return (
    <div className="bg-background pt-[calc(var(--announce-h,0px)+var(--header-h))]">
      <section className="border-b border-border bg-background-secondary">
        <div className="container-x grid items-center gap-10 py-10 md:py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <nav
              aria-label={fa ? "مسیر صفحه" : "Breadcrumb"}
              className="mb-8 flex items-center gap-3 text-xs text-foreground-secondary"
            >
              <Link href={href(locale, "/")} className="hover:text-accent">
                {fa ? "خانه" : "Home"}
              </Link>
              <span aria-hidden>/</span>
              <span>{fa ? "طراحان" : "Designers"}</span>
            </nav>
            <p className="mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-accent">
              <span className="h-px w-8 bg-accent" />
              {fa ? "آدم‌ها، ایده‌ها، آثار" : "People. Ideas. Original work."}
            </p>
            <h1 className="font-display text-[clamp(2rem,4vw,3.5rem)] leading-[1.4] text-foreground">
              {fa
                ? "با خالقان آثار آشنا شوید"
                : "Meet the people behind the work"}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-foreground-secondary">
              {fa
                ? "هر اثر، نگاه یک هنرمند است. طراحان و هنرمندان را کشف کنید، نمونه‌کارهایشان را ببینید و برای همکاری، از صفحهٔ اختصاصی آن‌ها شروع کنید."
                : "Every piece begins with a perspective. Discover artists and designers, explore their work, and find the right creative partner through their dedicated profile."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <a
                href="#artist-directory"
                className="inline-flex min-h-11 items-center gap-3 rounded-full bg-foreground px-6 text-sm text-background transition-colors hover:bg-accent"
              >
                {fa ? "کشف هنرمندان" : "Explore artists"}
                <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
              <span className="text-xs text-foreground-secondary">
                {formatNumber(artists.length, locale)}{" "}
                {fa ? "پروفایل در فهرست هنرمندان" : "profiles in the directory"}
              </span>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-border lg:aspect-[5/4]">
            {heroImage && (
              <Image
                src={heroImage}
                alt={
                  fa
                    ? "نگاهی به دنیای هنرمندان آتلیه رزی"
                    : "Inside the creative world of Rosie Atelier"
                }
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 45vw"
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute inset-x-6 bottom-6 border-t border-white/30 pt-4 text-white">
              <p className="text-xs uppercase tracking-widest text-white/70">
                ROSIE ATELIER · ARTISTS
              </p>
              <p className="mt-2 font-display text-xl">
                {fa
                  ? "نگاه‌های متفاوت، یک فضای مشترک"
                  : "Distinct perspectives. A shared space."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="artist-directory"
        className="container-x scroll-mt-[calc(var(--header-h)+2rem)] py-12 md:py-16"
      >
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">
              {fa ? "فهرست هنرمندان" : "The directory"}
            </p>
            <h2 className="mt-2 font-display text-h2">
              {fa
                ? "هنرمندِ هم‌نگاه خود را پیدا کنید"
                : "Find your creative connection"}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-foreground-secondary">
            {fa
              ? "جست‌وجو بر اساس نام، تخصص یا شهر؛ هر کارت، دریچه‌ای به آثار و دنیای یک هنرمند."
              : "Search by name, specialty or city. Each profile opens a window into an artist’s practice."}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <label htmlFor="artist-search" className="sr-only">
                {fa
                  ? "جست‌وجوی هنرمند، تخصص یا شهر"
                  : "Search artist, specialty or city"}
              </label>
              <Search
                className="pointer-events-none absolute start-4 top-3.5 h-4 w-4 text-muted"
                aria-hidden
              />
              <input
                id="artist-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  fa
                    ? "نام هنرمند، تخصص یا شهر…"
                    : "Artist name, specialty or city…"
                }
                className="h-11 w-full rounded-xl border border-border bg-background pe-4 ps-11 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden />
              <label
                htmlFor="artist-sort"
                className="text-xs text-foreground-secondary"
              >
                {fa ? "چینش" : "Sort"}
              </label>
              <select
                id="artist-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm md:min-w-40"
              >
                <option value="directory">
                  {fa ? "ترتیب فهرست" : "Directory order"}
                </option>
                <option value="works">
                  {fa ? "بیشترین نمونه‌کار" : "Most portfolio works"}
                </option>
                <option value="name">
                  {fa ? "نام هنرمند" : "Artist name"}
                </option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={fa ? "فیلتر تخصص" : "Filter by discipline"}
            >
              {disciplines.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={discipline === d.id}
                  onClick={() => setDiscipline(d.id)}
                  className={cn(
                    "min-h-10 rounded-full border px-4 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    discipline === d.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground-secondary hover:border-accent",
                  )}
                >
                  {fa ? d.fa : d.en}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground-secondary">
              <input
                type="checkbox"
                checked={commissions}
                onChange={(e) => setCommissions(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              {fa ? "پذیرش سفارش اختصاصی" : "Open to commissions"}
            </label>
          </div>
        </div>
        <div className="flex min-h-16 items-center justify-between gap-3 py-4 text-xs text-foreground-secondary">
          <p role="status" aria-live="polite">
            {formatNumber(filtered.length, locale)} {fa ? "هنرمند" : "artists"}
            {hasFilters
              ? fa
                ? " مطابق جست‌وجوی شما"
                : " matching your search"
              : ""}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-9 items-center gap-2 text-accent"
            >
              <X className="h-3.5 w-3.5" />
              {fa ? "پاک کردن فیلترها" : "Clear filters"}
            </button>
          )}
        </div>
        {filtered.length ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center">
            <Search className="mx-auto mb-4 h-7 w-7 text-muted" aria-hidden />
            <h3 className="font-display text-xl">
              {fa ? "هنرمندی پیدا نشد" : "No artists found"}
            </h3>
            <p className="mt-3 text-sm text-foreground-secondary">
              {fa
                ? "عبارت دیگری جست‌وجو کنید یا فیلترها را تغییر دهید."
                : "Try another search or adjust your filters."}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-full border border-border px-5 py-2 text-sm"
            >
              {fa ? "نمایش همهٔ هنرمندان" : "Show all artists"}
            </button>
          </div>
        )}
      </section>
      <section className="container-x pb-16">
        <div className="flex flex-col justify-between gap-6 rounded-2xl bg-foreground p-8 text-background md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="font-display text-2xl">
              {fa ? "جای نگاه شما اینجاست" : "Your perspective belongs here"}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 opacity-70">
              {fa
                ? "اگر هنرمند یا طراح هستید، برای ساخت پروفایل و معرفی آثارتان به جمع آتلیه رزی بپیوندید."
                : "Join Rosie Atelier to create your artist profile and introduce your work to a new audience."}
            </p>
          </div>
          <Link
            href={href(locale, "/creators/join")}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full border border-background/30 px-6 text-sm hover:bg-background/10"
          >
            {fa ? "پیوستن به هنرمندان" : "Join the artists"}
            <ArrowUpRight className="h-4 w-4 rtl-flip" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
