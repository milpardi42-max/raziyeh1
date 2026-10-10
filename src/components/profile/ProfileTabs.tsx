"use client";

import { artistPortfolioPath } from "@/lib/artist/portfolio";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Paintbrush, Send, ShieldCheck, Star } from "lucide-react";
import { useLocale } from "@/components/providers/AppProviders";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/States";
import {
  PatternCard,
  type PatternCardData,
} from "@/components/cards/PatternCard";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/cards/ProductCard";
import {
  PortfolioCard,
  type PortfolioCardData,
} from "@/components/cards/PortfolioCard";
import {
  EducationCard,
  type EducationCardData,
} from "@/components/cards/EducationCard";
import { StyleCard } from "@/components/cards/StyleCard";
import { formatPrice, href, t } from "@/lib/utils";
import type { Artist, ArtistServiceItem, Collection } from "@/lib/types";

interface Props {
  artist?: Artist;
  patterns: PatternCardData[];
  products: ProductCardData[];
  portfolios: PortfolioCardData[];
  education: EducationCardData[];
  collections: Collection[];
  reviews: { name: string; text: string; rating: number }[];
  services?: ArtistServiceItem[];
}

export function ProfileTabs({
  artist,
  patterns,
  products,
  portfolios,
  education,
  collections,
  reviews,
  services = [],
}: Props) {
  const { locale, dict } = useLocale();
  const fa = locale === "fa";

  const artistServices = (
    services.length > 0 ? services : (artist?.services ?? [])
  ).filter((service) => service.active !== false);

  const availableTabs = [
    { id: "portfolios", label: dict.nav.portfolio, count: portfolios.length },
    { id: "patterns", label: dict.nav.patterns, count: patterns.length },
    { id: "products", label: dict.common.products, count: products.length },
    {
      id: "services",
      label: fa ? "خدمات و سفارش اختصاصی" : "Services & commissions",
      count: artistServices.length,
    },
    { id: "education", label: dict.nav.education, count: education.length },
    {
      id: "collections",
      label: dict.nav.collections,
      count: collections.length,
    },
    { id: "reviews", label: dict.common.reviews, count: reviews.length },
  ].filter((item) => item.count > 0);
  const tabs = availableTabs.length
    ? availableTabs
    : [
        {
          id: "patterns",
          label: fa ? "آثار هنرمند" : "Artist’s work",
          count: 0,
        },
      ];
  const defaultTab = tabs[0].id;
  const [tab, setTab] = useState(defaultTab);

  return (
    <div className="container-x mt-12">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div key={tab} className="anim-fade-up py-10">
        {/* ══ Services & Pro Showcase Tab ════════════════════════════ */}
        {tab === "services" && (
          <div className="space-y-8">
            {/* Commission information */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-accent/30 bg-accent/5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold text-foreground">
                      {fa ? "خدمات این هنرمند" : "Work with this artist"}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-foreground-secondary leading-relaxed">
                    {artist?.commissionNotice
                      ? t(artist.commissionNotice, locale)
                      : fa
                        ? "خدمت مورد نظر را انتخاب کنید و جزئیات پروژه را در صفحهٔ درخواست همکاری با هنرمند به اشتراک بگذارید."
                        : "Choose a service and share your project details on the artist’s inquiry page."}
                  </p>
                </div>
              </div>

              {artistServices.length > 0 && (
                <Link
                  href={href(locale, `/artists/${artist?.slug}/inquiry`)}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-accent px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {fa ? "استعلام قیمت و ثبت پروژه" : "Request Custom Quote"}
                  </span>
                </Link>
              )}
            </div>

            {/* Custom Services Grid */}
            {artistServices.length === 0 ? (
              <EmptyState
                title={
                  fa
                    ? "خدمات اختصاصی ثبت نشده است."
                    : "No custom services listed yet."
                }
                description={
                  fa
                    ? "این هنرمند به‌زودی نمونه‌کارهای پتینه و خدمات خود را اضافه خواهد کرد."
                    : "This creator will add custom patina and design services soon."
                }
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {artistServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-soft transition-all hover:shadow-medium"
                  >
                    <div>
                      {/* Service Cover */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-background-secondary">
                        <Image
                          src={service.image}
                          alt={t(service.title, locale)}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="img-zoom object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        <div className="absolute top-3 inset-inline-start-3">
                          <span className="rounded-full bg-accent/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
                            {t(
                              service.categoryLabel ?? {
                                fa: "خدمت اختصاصی",
                                en: "Custom Service",
                              },
                              locale,
                            )}
                          </span>
                        </div>

                        {service.deliveryTime && (
                          <div className="absolute bottom-3 inset-inline-start-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">
                            <Clock className="h-3 w-3 text-accent" />
                            <span>{t(service.deliveryTime, locale)}</span>
                          </div>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3 className="mt-4 font-display text-base font-bold text-foreground leading-snug">
                        {t(service.title, locale)}
                      </h3>
                      <p className="mt-1.5 text-xs text-foreground-secondary leading-relaxed line-clamp-3">
                        {t(service.description, locale)}
                      </p>
                    </div>

                    {/* Pricing and Action */}
                    <div className="mt-5 border-t border-border pt-4">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs text-foreground-secondary">
                          {service.priceUnit
                            ? t(service.priceUnit, locale)
                            : fa
                              ? "شروع قیمت از"
                              : "Starting from"}
                        </span>
                        <span className="font-display text-base font-bold text-accent tabular">
                          {formatPrice(service.price, locale)}
                        </span>
                      </div>

                      <Link
                        href={href(
                          locale,
                          `/artists/${artist?.slug}/inquiry?service=${encodeURIComponent(service.id)}`,
                        )}
                        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-xs font-semibold text-background transition hover:bg-primary"
                      >
                        <Paintbrush className="h-3.5 w-3.5" />
                        <span>
                          {fa
                            ? "استعلام قیمت و ثبت سفارش"
                            : "Request Quote / Order"}
                        </span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ Patterns Tab ═══════════════════════════════════════════ */}
        {tab === "patterns" &&
          (patterns.length ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
              {patterns.map((p) => (
                <PatternCard key={p.id} pattern={p} />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {/* ══ Products Tab ═══════════════════════════════════════════ */}
        {tab === "products" &&
          (products.length ? (
            <div className="grid gap-5 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {/* ══ Portfolios Tab ═════════════════════════════════════════ */}
        {tab === "portfolios" &&
          (portfolios.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {portfolios.map((p) => (
                <div key={p.id} className="aspect-[16/10]">
                  <PortfolioCard item={p} hrefPath={artist ? artistPortfolioPath(artist.slug, p.slug) : undefined} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {/* ══ Collections Tab ════════════════════════════════════════ */}
        {tab === "collections" &&
          (collections.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c) => (
                <StyleCard
                  key={c.id}
                  href={href(locale, `/collections/${c.slug}`)}
                  title={t(c.title, locale)}
                  description={t(c.description, locale)}
                  image={c.cover}
                  className="aspect-[4/3]"
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {/* ══ Education Tab ══════════════════════════════════════════ */}
        {tab === "education" &&
          (education.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {education.map((e) => (
                <EducationCard key={e.id} item={e} />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {/* ══ Reviews Tab ════════════════════════════════════════════ */}
        {tab === "reviews" && (
          <ul className="grid gap-4 md:grid-cols-2">
            {reviews.length === 0 && (
              <li className="text-sm text-muted">
                {locale === "fa"
                  ? "هنوز نظری ثبت نشده است."
                  : "No reviews have been recorded yet."}
              </li>
            )}
            {reviews.map((r, i) => (
              <li
                key={i}
                className="rounded-2xl border border-border bg-surface p-5 shadow-soft"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-foreground">
                    {r.name}
                  </p>
                  <span className="inline-flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star
                        key={k}
                        className={`h-3.5 w-3.5 ${k < r.rating ? "fill-amber-400 text-amber-400" : "text-border"}`}
                      />
                    ))}
                  </span>
                </div>
                <p className="mt-2 text-xs text-foreground-secondary leading-relaxed">
                  {r.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
