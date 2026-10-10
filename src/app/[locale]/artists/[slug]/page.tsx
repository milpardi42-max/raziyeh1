import { isPublicArtist, publicArtist } from "@/lib/artist/public-profile";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  artistStats,
  enrichEducation,
  enrichPattern,
  enrichPortfolio,
  enrichProduct,
  getSite,
} from "@/lib/data/queries";
import { dictionaries } from "@/lib/i18n/dictionary";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { href, t } from "@/lib/utils";
import { getCspNonce } from "@/lib/security/nonce";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateStaticParams() {
  const content = await getSite();
  const site = {
    ...content,
    artists: content.artists.filter(isPublicArtist).map(publicArtist),
  };
  return LOCALES.flatMap((locale) =>
    site.artists
      .filter(isPublicArtist)
      .map((artist) => ({ locale, slug: artist.slug })),
  );
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const content = await getSite();
  const site = {
    ...content,
    artists: content.artists.filter(isPublicArtist).map(publicArtist),
  };
  const a = site.artists.find((x) => x.slug === slug);
  if (!a) return {};
  const title = t(a.name, locale);
  const description = t(a.bio, locale);
  const url = `https://rosieatelier.com/${locale}/artists/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/artists/${slug}` },
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      images: [{ url: a.cover, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [a.cover],
    },
  };
}

export default async function ArtistPage({ params }: Props) {
  const { locale, slug } = await params;
  const nonce = await getCspNonce();
  const content = await getSite();
  const site = {
    ...content,
    artists: content.artists.filter(isPublicArtist).map(publicArtist),
  };
  const artist = site.artists.find((x) => x.slug === slug);
  if (!artist) notFound();
  const d = dictionaries[locale];
  const s = artistStats(site, artist.id);
  const patternIds = new Set(s.patterns.map((p) => p.id));
  const collections = site.collections.filter((c) =>
    c.patternIds.some((id) => patternIds.has(id)),
  );
  // No persisted customer-review source exists yet. Never fabricate testimonials.
  const allReviews: { name: string; text: string; rating: number }[] = [];

  const breadcrumb = [
    { label: d.nav.home, href: href(locale, "/") },
    { label: d.nav.artists, href: href(locale, "/artists") },
    { label: t(artist.name, locale) },
  ];

  // JSON-LD Person schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: t(artist.name, locale),
    description: t(artist.bio, locale),
    image: artist.avatar,
    url: `https://rosieatelier.com/${locale}/artists/${slug}`,
    jobTitle: t(artist.profession, locale),
    address: {
      "@type": "PostalAddress",
      addressLocality: t(artist.location, locale),
    },
    ...(artist.social.instagram
      ? { sameAs: [`https://instagram.com/${artist.social.instagram}`] }
      : {}),
  };

  return (
    <article className="pt-[calc(var(--announce-h,0px)+var(--header-h))]">
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProfileHeader
        artist={artist}
        counts={{
          patterns: s.patterns.length,
          products: s.products.length,
          projects: s.portfolios.length,
        }}
      >
        <Breadcrumb
          items={breadcrumb}
          locale={locale}
          className="mb-4 text-white/60 [&_a]:text-white/60 [&_a:hover]:text-white [&_.text-foreground]:text-white [&_.text-foreground-secondary]:text-white/60 [&_.text-border]:text-white/25"
        />
      </ProfileHeader>
      <ProfileTabs
        key={artist.id}
        artist={artist}
        services={artist.services ?? []}
        patterns={s.patterns.map((p) => enrichPattern(site, p))}
        products={s.products.map((p) => enrichProduct(site, p))}
        portfolios={s.portfolios.map((p) => enrichPortfolio(site, p))}
        education={s.education.map((e) => enrichEducation(site, e))}
        collections={collections}
        reviews={allReviews}
      />
    </article>
  );
}
