import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireArtistOrAdmin as requireApprovedArtistOrAdmin } from "@/lib/marketplace/guard";
import { getContent, mutateCollection } from "@/lib/data/store";
import { withNoStore } from "@/lib/http";
import type { ArtistServiceItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

function mutationErrorResponse(error: unknown, operation: string) {
  if (error instanceof Error && error.message === "artist_not_found") {
    return NextResponse.json({ ok: false, error: "artist_not_found" }, withNoStore({ status: 404 }));
  }
  console.error(`Failed to ${operation} artist service data`, error);
  return NextResponse.json({ ok: false, error: "mutation_failed" }, withNoStore({ status: 500 }));
}

/** GET /api/artist/services — returns custom services & inquiries for current artist */
export async function GET() {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const content = await getContent();
  const artist = content.artists.find((a) => a.id === session.artistId || a.userId === session.id);

  if (!artist) {
    return NextResponse.json({ ok: true, services: [], inquiries: [], subscription: null }, withNoStore());
  }

  return NextResponse.json(
    {
      ok: true,
      services: artist.services ?? [],
      inquiries: artist.inquiries ?? [],
      subscription: artist.subscription ?? null,
      acceptsCommissions: artist.acceptsCommissions ?? true,
      commissionNotice: artist.commissionNotice ?? null,
    },
    withNoStore(),
  );
}

/** POST /api/artist/services — create a new custom service (patina, pattern, art, etc.) */
export async function POST(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const body = (await req.json().catch(() => null)) as Partial<ArtistServiceItem> | null;
  if (!body || !body.title) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  const newService: ArtistServiceItem = {
    id: `srv-${crypto.randomBytes(6).toString("hex")}`,
    title: body.title,
    category: body.category || "patina",
    categoryLabel: body.categoryLabel,
    description: body.description || { fa: "", en: "" },
    price: body.price || { fa: 0, en: 0 },
    priceUnit: body.priceUnit,
    deliveryTime: body.deliveryTime,
    image: body.image || "/images/products/wallpaper-botanical.jpg",
    gallery: body.gallery || [],
    featured: Boolean(body.featured),
    active: body.active !== false,
  };

  try {
    const { result, etag } = await mutateCollection("artists", (artists) => {
      const index = artists.findIndex((artist) => artist.id === session.artistId || artist.userId === session.id);
      if (index < 0) throw new Error("artist_not_found");

      const services = [...(artists[index].services ?? []), newService];
      const updatedArtist = { ...artists[index], services };
      const nextArtists = [...artists];
      nextArtists[index] = updatedArtist;
      return { items: nextArtists, result: { service: newService, services } };
    });
    return withContentEtag(NextResponse.json({ ok: true, ...result }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "create");
  }
}

/** PUT /api/artist/services — update an existing service or inquiry status */
export async function PUT(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const body = (await req.json().catch(() => null)) as {
    service?: Partial<ArtistServiceItem> & { id: string };
    inquiryId?: string;
    inquiryStatus?: "pending" | "in_discussion" | "accepted" | "completed" | "archived";
    acceptsCommissions?: boolean;
    commissionNotice?: { fa: string; en: string };
  } | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  try {
    const { result: updatedArtist, etag } = await mutateCollection("artists", (artists) => {
      const index = artists.findIndex((artist) => artist.id === session.artistId || artist.userId === session.id);
      if (index < 0) throw new Error("artist_not_found");

      const artist = artists[index];
      let updatedArtist = { ...artist };

      if (body.service?.id) {
        const services = (artist.services ?? []).map((service) =>
          service.id === body.service?.id ? { ...service, ...body.service } : service,
        );
        updatedArtist = { ...updatedArtist, services };
      }

      if (body.inquiryId && body.inquiryStatus) {
        const inquiries = (artist.inquiries ?? []).map((inquiry) =>
          inquiry.id === body.inquiryId ? { ...inquiry, status: body.inquiryStatus! } : inquiry,
        );
        updatedArtist = { ...updatedArtist, inquiries };
      }

      if (body.acceptsCommissions !== undefined) {
        updatedArtist = { ...updatedArtist, acceptsCommissions: body.acceptsCommissions };
      }

      if (body.commissionNotice !== undefined) {
        updatedArtist = { ...updatedArtist, commissionNotice: body.commissionNotice };
      }

      const nextArtists = [...artists];
      nextArtists[index] = updatedArtist;
      return { items: nextArtists, result: updatedArtist };
    });
    return withContentEtag(NextResponse.json({ ok: true, artist: updatedArtist }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "update");
  }
}

/** DELETE /api/artist/services?id=... — delete a service */
export async function DELETE(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("id");
  if (!serviceId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, withNoStore({ status: 400 }));
  }

  try {
    const { result: services, etag } = await mutateCollection("artists", (artists) => {
      const index = artists.findIndex((artist) => artist.id === session.artistId || artist.userId === session.id);
      if (index < 0) throw new Error("artist_not_found");

      const services = (artists[index].services ?? []).filter((service) => service.id !== serviceId);
      const nextArtists = [...artists];
      nextArtists[index] = { ...artists[index], services };
      return { items: nextArtists, result: services };
    });
    return withContentEtag(NextResponse.json({ ok: true, services }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "delete");
  }
}
