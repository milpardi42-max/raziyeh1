import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtistPortfolio } from "@/lib/artist/portfolio-data";
import { artistPortfolioPath } from "@/lib/artist/portfolio";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PortfolioCard } from "@/components/cards/PortfolioCard";
import type { Locale } from "@/lib/i18n/types";
import { href, t, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ locale: Locale; slug: string; workSlug: string }>;
};
async function details(slug: string, workSlug: string) {
  const { artist, works } = await getArtistPortfolio(slug);
  // Search only inside this artist's published works, never the global gallery.
  const work = works.find((work) => work.slug === workSlug);
  if (!work) notFound();
  return {
    artist,
    work,
    related: works.filter((item) => item.id !== work.id).slice(0, 3),
  };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, workSlug } = await params;
  const { artist, work } = await details(slug, workSlug);
  const url = `/${locale}${artistPortfolioPath(slug, workSlug)}`;
  return {
    title: `${t(work.title, locale)} · ${t(artist.name, locale)}`,
    description: t(work.intro, locale),
    alternates: { canonical: url },
    openGraph: {
      title: t(work.title, locale),
      description: t(work.intro, locale),
      url,
      images: [{ url: work.cover }],
    },
  };
}
export default async function ArtistWorkPage({ params }: Props) {
  const { locale, slug, workSlug } = await params;
  const { artist, work, related } = await details(slug, workSlug);
  const fa = locale === "fa";
  const portfolioUrl = href(locale, artistPortfolioPath(slug));
  return (
    <article className="pb-20 pt-[calc(var(--announce-h,0px)+var(--header-h)+2rem)]">
      <header className="container-x">
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
            {
              label: fa ? "پورتفولیوی هنرمند" : "Artist portfolio",
              href: portfolioUrl,
            },
            { label: t(work.title, locale) },
          ]}
        />
        <p className="mt-10 text-sm text-accent">
          {fa ? "اثری از" : "A work by"} {t(artist.name, locale)}
        </p>
        <h1 className="mt-3 max-w-4xl font-display text-h1">
          {t(work.title, locale)}
        </h1>
        <p className="mb-8 mt-4 max-w-2xl text-body-lg text-foreground-secondary">
          {t(work.subtitle, locale)}
        </p>
        {work.cover && (
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-background-secondary">
            <Image
              src={work.cover}
              alt={t(work.title, locale)}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        )}
      </header>
      <section className="container-x grid gap-8 py-12 lg:grid-cols-[1.5fr_1fr]">
        <p className="whitespace-pre-line text-body-lg leading-8">
          {t(work.intro, locale)}
        </p>
        <dl className="grid grid-cols-2 gap-6 rounded-xl border border-border p-6 text-sm">
          {[
            [fa ? "هنرمند" : "Artist", t(artist.name, locale)],
            [fa ? "سال" : "Year", formatNumber(work.year, locale)],
            [fa ? "موقعیت" : "Location", t(work.location, locale)],
            [fa ? "محدودهٔ کار" : "Scope", t(work.scope, locale)],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-2 leading-6">{value}</dd>
              </div>
            ))}
        </dl>
      </section>
      <section className="container-x space-y-8">
        {work.story.map((block, index) => (
          <div key={index}>
            {block.text &&
              (block.type === "quote" ? (
                <blockquote className="border-s-2 border-accent ps-6 font-display text-2xl">
                  {t(block.text, locale)}
                </blockquote>
              ) : (
                <p className="prose-ra whitespace-pre-line">
                  {t(block.text, locale)}
                </p>
              ))}
            {(block.type === "pair"
              ? (block.images ?? [])
              : block.image
                ? [block.image]
                : []
            ).map((image, i) => (
              <div
                key={`${image}-${i}`}
                className="relative my-4 aspect-[16/10] overflow-hidden rounded-xl bg-background-secondary"
              >
                <Image
                  src={image}
                  alt={
                    block.caption
                      ? t(block.caption, locale)
                      : t(work.title, locale)
                  }
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              </div>
            ))}
            {block.caption && (
              <p className="mt-2 text-sm text-muted">
                {t(block.caption, locale)}
              </p>
            )}
          </div>
        ))}
      </section>
      {work.gallery.length > 0 && (
        <section className="container-x py-12">
          <h2 className="mb-6 font-display text-h2">
            {fa ? "تصاویر اثر" : "Work gallery"}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {work.gallery.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="relative aspect-[4/3] overflow-hidden rounded-xl bg-background-secondary"
              >
                <Image
                  src={image}
                  alt={`${t(work.title, locale)} — ${formatNumber(index + 1, locale)}`}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="container-x mt-12 border-t border-border pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-h2">
            {fa ? "پورتفولیوی همین هنرمند" : "More from this artist"}
          </h2>
          <Link
            href={portfolioUrl}
            className="text-sm text-accent hover:underline"
          >
            {fa ? "بازگشت به پورتفولیوی هنرمند" : "Back to artist portfolio"}
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((item) => (
            <div key={item.id} className="aspect-[4/3]">
              <PortfolioCard
                item={item}
                hrefPath={artistPortfolioPath(slug, item.slug)}
              />
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
