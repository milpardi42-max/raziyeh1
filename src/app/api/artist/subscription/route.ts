import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getContent, updateCollection } from "@/lib/data/store";
import { withNoStore } from "@/lib/http";
import type { ArtistSubscription } from "@/lib/types";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
}

/**
 * POST /api/artist/subscription — upgrades or updates artist subscription plan
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "artist" && session.role !== "admin")) {
    return unauthorized();
  }

  const body = (await req.json().catch(() => null)) as {
    planId: "starter" | "pro" | "studio";
    periodMonths?: number;
  } | null;

  if (!body || !body.planId) {
    return NextResponse.json({ ok: false, error: "missing_plan" }, withNoStore({ status: 400 }));
  }

  const content = await getContent();
  const idx = content.artists.findIndex((a) => a.id === session.artistId || a.userId === session.id);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: "artist_not_found" }, withNoStore({ status: 404 }));
  }

  const artist = content.artists[idx];
  const months = body.periodMonths || (body.planId === "starter" ? 12 : 1);
  const now = new Date();
  const validUntil = new Date(now.setMonth(now.getMonth() + months)).toISOString();

  const planNames: Record<"starter" | "pro" | "studio", { fa: string; en: string }> = {
    starter: { fa: "عضویت پایه (Basic)", en: "Basic Membership" },
    pro: { fa: "عضویت حرفه‌ای هنرمند (Artist Pro)", en: "Artist Pro Membership" },
    studio: { fa: "عضویت استودیو ویژه اساتید (Studio VIP)", en: "Studio VIP Master Membership" },
  };

  const badges: Record<"starter" | "pro" | "studio", { fa: string; en: string }> = {
    starter: { fa: "طراح عضو", en: "Member Designer" },
    pro: { fa: "هنرمند ویژه Pro", en: "Pro Artist" },
    studio: { fa: "استاد برگزیده VIP", en: "Master VIP" },
  };

  const subscription: ArtistSubscription = {
    planId: body.planId,
    planName: planNames[body.planId],
    status: "active",
    validUntil,
    autoRenew: true,
    badge: badges[body.planId],
  };

  const updatedArtist = {
    ...artist,
    subscription,
    acceptsCommissions: true,
  };

  const allArtists = content.artists.map((a, i) => (i === idx ? updatedArtist : a));
  await updateCollection("artists", allArtists);

  return NextResponse.json({ ok: true, subscription, artist: updatedArtist }, withNoStore());
}
