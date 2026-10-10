"use client";

import { artistPortfolioPath } from "@/lib/artist/portfolio";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Globe, MapPin, Camera, UserRound } from "lucide-react";
import { useLocale } from "@/components/providers/AppProviders";
import { formatNumber, href, t } from "@/lib/utils";
import type { Artist } from "@/lib/types";

function websiteUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function ProfileHeader({
  artist,
  counts,
  children,
}: {
  artist: Artist;
  counts: { patterns: number; products: number; projects: number };
  children?: React.ReactNode;
}) {
  const { locale } = useLocale();
  const fa = locale === "fa";
  const website = websiteUrl(artist.social.website);
  const canInquire =
    artist.acceptsCommissions ||
    artist.services?.some((s) => s.active !== false);
  return (
    <header className="pb-4">
      <div className="relative h-64 overflow-hidden bg-background-secondary sm:h-80 lg:h-96">
        {artist.cover && (
          <Image
            src={artist.cover}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/25" />
        <div className="container-x relative pt-6">{children}</div>
      </div>
      <div className="container-x relative">
        <div className="relative -mt-12 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border bg-background-secondary sm:h-32 sm:w-32">
                {artist.avatar ? (
                  <Image
                    src={artist.avatar}
                    alt={t(artist.name, locale)}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <UserRound
                    className="m-auto h-full w-10 text-muted"
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-widest text-accent">
                  {fa ? "پروفایل هنرمند" : "Artist profile"}
                </p>
                <h1 className="mt-2 break-words font-display text-2xl leading-relaxed sm:text-4xl">
                  {t(artist.name, locale)}
                </h1>
                <p className="mt-2 text-sm leading-6 text-foreground-secondary">
                  {t(artist.profession, locale)}
                </p>
                {t(artist.location, locale) && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {t(artist.location, locale)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link href={href(locale, artistPortfolioPath(artist.slug))} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-border px-6 text-sm hover:border-accent">{fa ? "پورتفولیوی اختصاصی هنرمند" : "Artist portfolio"}<ArrowUpRight className="h-4 w-4 rtl-flip" aria-hidden /></Link>
              {canInquire && (
                <Link
                  href={href(locale, `/artists/${artist.slug}/inquiry`)}
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-foreground px-6 text-sm text-background hover:bg-accent"
                >
                  {fa ? "درخواست همکاری" : "Discuss a project"}
                  <ArrowUpRight className="h-4 w-4 rtl-flip" aria-hidden />
                </Link>
              )}
              <div className="flex items-center gap-2">
                {artist.social.instagram && (
                  <a
                    href={`https://www.instagram.com/${encodeURIComponent(artist.social.instagram.replace(/^@/, ""))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:border-accent"
                  >
                    <Camera className="h-4 w-4" />
                  </a>
                )}
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={fa ? "وب‌سایت هنرمند" : "Artist website"}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:border-accent"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="mt-8 grid gap-8 border-t border-border pt-8 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
            <div>
              <h2 className="text-sm font-semibold">
                {fa ? "دربارهٔ هنرمند" : "About the artist"}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-8 text-foreground-secondary">
                {t(artist.bio, locale) ||
                  (fa
                    ? "معرفی این هنرمند هنوز تکمیل نشده است."
                    : "This artist’s introduction has not been added yet.")}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-3 self-start rounded-xl bg-background-secondary p-4 text-center">
              {[
                [counts.patterns, fa ? "پترن" : "Patterns"],
                [counts.products, fa ? "محصول" : "Products"],
                [counts.projects, fa ? "نمونه‌کار" : "Portfolio works"],
              ].map(([value, label]) => (
                <div key={String(label)} className="py-2">
                  <dt className="text-xs text-foreground-secondary">{label}</dt>
                  <dd className="mt-2 font-display text-2xl tabular-nums">
                    {formatNumber(Number(value), locale)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </header>
  );
}
