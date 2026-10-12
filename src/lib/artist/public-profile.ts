import type { Artist, SiteContent } from "@/lib/types";

export function isPublicArtist(artist: Artist) {
  // Artists created from user accounts must be explicitly approved. Legacy
  // site-owned artists have no status/userId and remain public.
  return artist.status ? artist.status === "approved" : !artist.userId;
}

/** Remove a non-approved artist and any site content directly attributed to them. */
export function publicSiteContent(site: SiteContent): SiteContent {
  const publicArtists = site.artists.filter(isPublicArtist);
  const publicArtistIds = new Set(publicArtists.map((artist) => artist.id));
  const isAvailable = (artistId: string | null | undefined) =>
    !artistId || publicArtistIds.has(artistId);

  return {
    ...site,
    artists: publicArtists,
    patterns: site.patterns.filter((item) => isAvailable(item.artistId)),
    products: site.products.filter((item) => isAvailable(item.artistId)),
    portfolios: site.portfolios.filter((item) => isAvailable(item.artistId)),
    education: site.education.filter((item) => isAvailable(item.authorId)),
    stories: site.stories.filter((item) => isAvailable(item.artistId)),
  };
}

/** Never serialize account information or client inquiries into public pages. */
export function publicArtist(artist: Artist): Artist {
  return {
    id: artist.id,
    slug: artist.slug,
    name: artist.name,
    profession: artist.profession,
    bio: artist.bio,
    avatar: artist.avatar,
    cover: artist.cover,
    location: artist.location,
    social: artist.social,
    featured: artist.featured,
    tags: artist.tags,
    followers: 0,
    rating: 0,
    reviewsCount: 0,
    services: artist.services?.filter((service) => service.active !== false),
    acceptsCommissions: artist.acceptsCommissions,
    commissionNotice: artist.commissionNotice,
  };
}
