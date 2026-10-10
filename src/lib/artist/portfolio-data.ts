import "server-only";
import { notFound } from "next/navigation";
import { getSite, enrichPortfolio } from "@/lib/data/queries";
import { isPublicArtist, publicArtist } from "./public-profile";
import { artistPortfolioWorks } from "./portfolio";

export async function getArtistPortfolio(slug: string) {
  const content = await getSite();
  const rawArtist = content.artists.find(
    (a) => a.slug === slug && isPublicArtist(a),
  );
  if (!rawArtist) notFound();
  const artist = publicArtist(rawArtist);
  const site = { ...content, artists: [artist] };
  const works = artistPortfolioWorks(content.portfolios, artist.id).map(
    (work) => enrichPortfolio(site, work),
  );
  return { artist, works };
}
