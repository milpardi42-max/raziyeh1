import { isPublicArtist, publicArtist } from "@/lib/artist/public-profile";
import type { Metadata } from "next";
import { ArtistsHubView } from "@/components/artist/ArtistsHubView";
import { artistStats, getSite } from "@/lib/data/queries";
import { dictionaries } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const d = dictionaries[locale];
  return {
    title: `${d.nav.artists} | ${d.brand}`,
    description:
        locale === "fa"
          ? "کشف طراحان آتلیه رزی؛ معرفی، نمونه‌کارها و صفحهٔ اختصاصی هر طراح."
          : "Meet the designers of Rosie Atelier. Explore their profiles, portfolios and creative practice.",
    alternates: { canonical: `/${locale}/artists` },
  };
}

export default async function ArtistsPage() {
  const site = await getSite();

  const artists = site.artists.filter(isPublicArtist).map((a) => {
    const s = artistStats(site, a.id);
    const portfolioImages = s.portfolios.map((pf) => pf.cover).filter(Boolean);
    const patternImages = s.patterns.map((p) => p.image).filter(Boolean);
    const serviceImages = (a.services ?? [])
      .filter((srv) => srv.active !== false)
      .map((srv) => srv.image)
      .filter(Boolean);
    const allPreviews = Array.from(
      new Set([...serviceImages, ...patternImages, ...portfolioImages]),
    );

    return {
      ...publicArtist(a),
      featuredPattern: s.patterns[0]
        ? {
            id: s.patterns[0].id,
            title: s.patterns[0].title,
            image: s.patterns[0].image,
          }
        : null,
      portfolioPreview: allPreviews.slice(0, 4),
      counts: {
        patterns: s.patterns.length,
        projects: s.portfolios.length,
        products: s.products.length,
      },
    };
  });

  const heroImage = artists[0]?.cover || site.hero.image;

  return <ArtistsHubView artists={artists} heroImage={heroImage} />;
}
