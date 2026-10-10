import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { getContent, updateCollection } from "@/lib/data/store";
import { withNoStore } from "@/lib/http";
import type { ArtistServiceItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
}

/** GET /api/artist/services — returns custom services & inquiries for current artist */
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "artist" && session.role !== "admin")) {
    return unauthorized();
  }

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
  const session = await getSession();
  if (!session || (session.role !== "artist" && session.role !== "admin")) {
    return unauthorized();
  }

  const content = await getContent();
  const idx = content.artists.findIndex((a) => a.id === session.artistId || a.userId === session.id);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: "artist_not_found" }, withNoStore({ status: 404 }));
  }

  const body = (await req.json().catch(() => null)) as Partial<ArtistServiceItem> | null;
  if (!body || !body.title) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  const artist = content.artists[idx];
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

  const services = [...(artist.services ?? []), newService];
  const updatedArtist = { ...artist, services };
  const allArtists = content.artists.map((a, i) => (i === idx ? updatedArtist : a));

  await updateCollection("artists", allArtists);

  return NextResponse.json({ ok: true, service: newService, services }, withNoStore());
}

/** PUT /api/artist/services — update an existing service or inquiry status */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "artist" && session.role !== "admin")) {
    return unauthorized();
  }

  const content = await getContent();
  const idx = content.artists.findIndex((a) => a.id === session.artistId || a.userId === session.id);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: "artist_not_found" }, withNoStore({ status: 404 }));
  }

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

  const artist = content.artists[idx];
  let updatedArtist = { ...artist };

  if (body.service?.id) {
    const services = (artist.services ?? []).map((s) =>
      s.id === body.service?.id ? { ...s, ...body.service } : s,
    );
    updatedArtist = { ...updatedArtist, services };
  }

  if (body.inquiryId && body.inquiryStatus) {
    const inquiries = (artist.inquiries ?? []).map((inq) =>
      inq.id === body.inquiryId ? { ...inq, status: body.inquiryStatus! } : inq,
    );
    updatedArtist = { ...updatedArtist, inquiries };
  }

  if (body.acceptsCommissions !== undefined) {
    updatedArtist = { ...updatedArtist, acceptsCommissions: body.acceptsCommissions };
  }

  if (body.commissionNotice !== undefined) {
    updatedArtist = { ...updatedArtist, commissionNotice: body.commissionNotice };
  }

  const allArtists = content.artists.map((a, i) => (i === idx ? updatedArtist : a));
  await updateCollection("artists", allArtists);

  return NextResponse.json({ ok: true, artist: updatedArtist }, withNoStore());
}

/** DELETE /api/artist/services?id=... — delete a service */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "artist" && session.role !== "admin")) {
    return unauthorized();
  }

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("id");
  if (!serviceId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, withNoStore({ status: 400 }));
  }

  const content = await getContent();
  const idx = content.artists.findIndex((a) => a.id === session.artistId || a.userId === session.id);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: "artist_not_found" }, withNoStore({ status: 404 }));
  }

  const artist = content.artists[idx];
  const services = (artist.services ?? []).filter((s) => s.id !== serviceId);
  const updatedArtist = { ...artist, services };
  const allArtists = content.artists.map((a, i) => (i === idx ? updatedArtist : a));

  await updateCollection("artists", allArtists);

  return NextResponse.json({ ok: true, services }, withNoStore());
}
