import type { Artist } from "@/lib/types";

export function isPublicArtist(artist: Artist) {
  return !artist.status || artist.status === "approved";
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
