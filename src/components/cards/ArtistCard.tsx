"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ImageIcon, MapPin, UserRound } from "lucide-react";
import { useLocale } from "@/components/providers/AppProviders";
import { cn, formatNumber, href, t } from "@/lib/utils";
import type { Artist } from "@/lib/types";

export interface ArtistCardData extends Artist {
  featuredPattern?: { image: string } | null;
  portfolioPreview: string[];
  counts: { patterns: number; projects: number; products?: number };
}

/** One semantic link, one cover, one work preview, and a consistent details area. */
export function ArtistCard({
  artist,
  className,
}: {
  artist: ArtistCardData;
  variant?: "default" | "large";
  className?: string;
}) {
  const { locale } = useLocale();
  const fa = locale === "fa";
  const name = t(artist.name, locale);
  const preview =
    artist.portfolioPreview.find(Boolean) || artist.featuredPattern?.image;
  const location = t(artist.location, locale);

  return (
    <article className={cn("h-full min-w-0", className)}>
      <Link
        href={href(locale, `/artists/${artist.slug}`)}
        aria-label={fa ? `مشاهده پروفایل ${name}` : `View ${name}'s profile`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-[box-shadow,border-color] duration-300 hover:border-accent/40 hover:shadow-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-background-secondary">
          {artist.cover && (
            <Image
              src={artist.cover}
              alt=""
              fill
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
          <div className="absolute start-4 top-4 inline-flex items-center gap-2 rounded-full bg-surface/95 px-3 py-1.5 text-[11px] text-foreground shadow-sm">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {fa ? "پروفایل هنرمند" : "Artist profile"}
          </div>
          <div className="absolute bottom-4 end-4 w-[36%] rounded-lg border border-white/70 bg-surface p-1 shadow-lg">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-background-secondary">
              {preview ? (
                <Image
                  src={preview}
                  alt={fa ? `پیش‌نمایش اثر ${name}` : `Work preview by ${name}`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  <ImageIcon className="h-6 w-6" aria-hidden />
                </div>
              )}
            </div>
            <p className="py-1 text-center text-[10px] text-foreground-secondary">
              {preview
                ? fa
                  ? "نگاهی به آثار"
                  : "Work preview"
                : fa
                  ? "بدون پیش‌نمایش"
                  : "No preview yet"}
            </p>
          </div>
          <div className="absolute bottom-4 start-4 h-16 w-16 overflow-hidden rounded-full border-[3px] border-white bg-background-secondary shadow-md">
            {artist.avatar ? (
              <Image
                src={artist.avatar}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <UserRound className="m-auto h-full w-7 text-muted" aria-hidden />
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <h3 className="line-clamp-1 font-display text-xl font-semibold text-foreground transition-colors group-hover:text-accent">
            {name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-accent">
            {t(artist.profession, locale) ||
              (fa ? "هنرمند مستقل" : "Independent artist")}
          </p>
          <p className="mt-3 flex min-h-5 items-center gap-1.5 text-xs text-foreground-secondary">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {location || (fa ? "موقعیت ثبت نشده" : "Location not listed")}
            </span>
          </p>
          <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-foreground-secondary">
            {t(artist.bio, locale) ||
              (fa
                ? "آثار و اطلاعات این هنرمند را در صفحهٔ اختصاصی او ببینید."
                : "Explore this artist’s work and details on their dedicated page.")}
          </p>
          <div className="mt-auto pt-5">
            <div className="flex items-center gap-4 border-t border-border pt-4 text-xs text-foreground-secondary">
              <span>
                <strong className="font-medium tabular-nums text-foreground">
                  {formatNumber(artist.counts.patterns, locale)}
                </strong>{" "}
                {fa ? "پترن" : "patterns"}
              </span>
              <span>
                <strong className="font-medium tabular-nums text-foreground">
                  {formatNumber(artist.counts.projects, locale)}
                </strong>{" "}
                {fa ? "نمونه‌کار" : "portfolio works"}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm font-medium text-foreground">
              <span>
                {fa ? "مشاهده پروفایل و آثار" : "Explore profile & work"}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background-secondary transition-colors group-hover:bg-accent group-hover:text-white">
                <ArrowUpRight className="h-4 w-4 rtl-flip" aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
