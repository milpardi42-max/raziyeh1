import { NextResponse } from "next/server";
import crypto from "crypto";
import { getContent, updateCollection } from "@/lib/data/store";
import { isPublicArtist } from "@/lib/artist/public-profile";
import { withNoStore } from "@/lib/http";
import { clientIp, recordAttempt, tooManyAttempts } from "@/lib/rate-limit";
import type { ClientInquiry } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  const content = await getContent();
  const artist = content.artists.find(
    (a) =>
      isPublicArtist(a) &&
      (artistId ? a.id === artistId : !!artistSlug && a.slug === artistSlug),
  );
  if (!artist || (artistSlug && artist.slug !== artistSlug))
    return NextResponse.json(
      { ok: false, error: "artist_not_found" },
      withNoStore({ status: 404 }),
    );
  const services = (artist.services ?? []).filter((s) => s.active !== false);
  if (!artist.acceptsCommissions && !services.length)
    return NextResponse.json(
      { ok: false, error: "commissions_closed" },
      withNoStore({ status: 409 }),
    );
  const serviceId = text("serviceId", 200);
  const service = services.find((s) => s.id === serviceId);
  if (serviceId && !service)
    return NextResponse.json(
      { ok: false, error: "service_not_found" },
      withNoStore({ status: 400 }),
    );
  const inquiry: ClientInquiry = {
    id: `inq-${crypto.randomBytes(6).toString("hex")}`,
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
    createdAt: new Date().toISOString(),
  };
  await updateCollection(
    "artists",
    content.artists.map((a) =>
      a.id === artist.id
        ? { ...a, inquiries: [inquiry, ...(a.inquiries ?? [])] }
        : a,
    ),
  );
  return NextResponse.json({ ok: true, inquiryId: inquiry.id }, withNoStore());
}
