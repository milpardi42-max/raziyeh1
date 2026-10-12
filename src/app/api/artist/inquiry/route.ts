import { NextResponse } from "next/server";
import crypto from "crypto";
import { mutateCollection } from "@/lib/data/store";
import { isPublicArtist } from "@/lib/artist/public-profile";
import { withNoStore } from "@/lib/http";
import { clientIp, recordAttempt, tooManyAttempts } from "@/lib/rate-limit";
import type { ClientInquiry } from "@/lib/types";

export const dynamic = "force-dynamic";

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

function mutationErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "artist_not_found") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 404 }));
  }
  if (code === "commissions_closed") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 409 }));
  }
  if (code === "service_not_found") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 400 }));
  }
  console.error("Failed to create artist inquiry", error);
  return NextResponse.json({ ok: false, error: "inquiry_create_failed" }, withNoStore({ status: 500 }));
}

/** Bind the inquiry to the exact public artist/service, never a fallback recipient. */
export async function POST(req: Request) {
  const rlKey = `inquiry:${clientIp(req)}`;
  if (tooManyAttempts(rlKey))
    return NextResponse.json(
      { ok: false, error: "too_many_attempts" },
      withNoStore({ status: 429 }),
    );
  recordAttempt(rlKey);
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      withNoStore({ status: 400 }),
    );
  const text = (key: string, limit: number) =>
    typeof body[key] === "string" ? body[key].trim().slice(0, limit) : "";
  const clientName = text("clientName", 120),
    clientPhone = text("clientPhone", 40),
    message = text("message", 5000);
  if (!clientName || !clientPhone || !message)
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      withNoStore({ status: 400 }),
    );
  const artistId = text("artistId", 200),
    artistSlug = text("artistSlug", 200);
  const serviceId = text("serviceId", 200);
  const inquiryId = `inq-${crypto.randomBytes(6).toString("hex")}`;
  const createdAt = new Date().toISOString();

  try {
    const { result: inquiry, etag } = await mutateCollection("artists", (artists) => {
      const index = artists.findIndex(
        (artist) => isPublicArtist(artist)
          && (artistId ? artist.id === artistId : !!artistSlug && artist.slug === artistSlug),
      );
      const artist = index < 0 ? undefined : artists[index];
      if (!artist || (artistSlug && artist.slug !== artistSlug)) throw new Error("artist_not_found");

      const services = (artist.services ?? []).filter((service) => service.active !== false);
      if (!artist.acceptsCommissions && !services.length) throw new Error("commissions_closed");
      const service = services.find((candidate) => candidate.id === serviceId);
      if (serviceId && !service) throw new Error("service_not_found");

      const inquiry: ClientInquiry = {
        id: inquiryId,
        artistId: artist.id,
        serviceId: service?.id,
        serviceTitle: service?.title,
        clientName,
        clientPhone,
        clientEmail: text("clientEmail", 254),
        projectType: text("projectType", 200) || "درخواست همکاری",
        scopeOrDimensions: text("scopeOrDimensions", 200),
        estimatedBudget: text("estimatedBudget", 200),
        message,
        status: "pending",
        createdAt,
      };
      const nextArtists = [...artists];
      nextArtists[index] = { ...artist, inquiries: [inquiry, ...(artist.inquiries ?? [])] };
      return { items: nextArtists, result: inquiry };
    });
    return withContentEtag(NextResponse.json({ ok: true, inquiryId: inquiry.id }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
