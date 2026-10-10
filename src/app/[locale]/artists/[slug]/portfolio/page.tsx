import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getArtistPortfolio } from "@/lib/artist/portfolio-data";
import { artistPortfolioPath } from "@/lib/artist/portfolio";
import { PortfolioCard } from "@/components/cards/PortfolioCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { href, t, formatNumber } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/types";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: Locale; slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const { artist } = await getArtistPortfolio(slug);
  return {
    title: `${locale === "fa" ? "پورتفولیوی" : "Portfolio of"} ${t(artist.name, locale)}`,
    description: t(artist.bio, locale),
    alternates: { canonical: `/${locale}${artistPortfolioPath(slug)}` },
  };
}
export default async function ArtistPortfolioPage({ params }: Props) {
  const { locale, slug } = await params;
  const { artist, works } = await getArtistPortfolio(slug);
  const fa = locale === "fa";
  return (
    <article className="container-x pb-20 pt-[calc(var(--announce-h,0px)+var(--header-h)+2rem)]">
      <Breadcrumb
        locale={locale}
        items={[
          {
            label: fa ? "هنرمندان" : "Artists",
            href: href(locale, "/artists"),
          },
          {
            label: t(artist.name, locale),
            href: href(locale, `/artists/${slug}`),
          },
          { label: fa ? "پورتفولیوی هنرمند" : "Artist portfolio" },
        ]}
      />
      <header className="my-10 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <p className="text-sm text-accent">
            {fa ? "پورتفولیوی اختصاصی هنرمند" : "Artist’s own portfolio"}
          </p>
          <h1 className="mt-3 font-display text-h1">
            {t(artist.name, locale)}
          </h1>
          <p className="mt-3 text-sm text-foreground-secondary">
            {t(artist.profession, locale)} ·{" "}
            {formatNumber(works.length, locale)}{" "}
            {fa ? "نمونه‌کار منتشرشده" : "published works"}
          </p>
        </div>
        <Link
          href={href(locale, `/artists/${slug}`)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm hover:border-accent"
        >
          {fa ? "معرفی و اطلاعات هنرمند" : "About the artist"}
          <ArrowUpRight className="h-4 w-4 rtl-flip" />
        </Link>
      </header>
      {works.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((work) => (
            <div key={work.id} className="aspect-[4/3]">
              <PortfolioCard
                item={work}
                hrefPath={artistPortfolioPath(slug, work.slug)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <h2 className="font-display text-xl">
            {fa ? "هنوز نمونه‌کاری منتشر نشده است" : "No published work yet"}
          </h2>
          <p className="mt-3 text-sm text-muted">
            {fa
              ? "نمونه‌کارهای تأییدشدهٔ این هنرمند در همین صفحه نمایش داده می‌شوند."
              : "This artist’s approved portfolio works will appear here."}
          </p>
        </div>
      )}
    </article>
  );
}
