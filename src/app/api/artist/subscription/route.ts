import { NextResponse } from "next/server";
import { requireArtistOrAdmin as requireApprovedArtistOrAdmin } from "@/lib/marketplace/guard";
import { mutateCollection } from "@/lib/data/store";
import { withNoStore } from "@/lib/http";
import type { ArtistSubscription } from "@/lib/types";

export const dynamic = "force-dynamic";

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

/**
 * POST /api/artist/subscription — upgrades or updates artist subscription plan
 */
export async function POST(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const body = (await req.json().catch(() => null)) as {
    planId: "starter" | "pro" | "studio";
    periodMonths?: number;
  } | null;

  if (!body || !body.planId) {
    return NextResponse.json({ ok: false, error: "missing_plan" }, withNoStore({ status: 400 }));
  }

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

  try {
    const { result: updatedArtist, etag } = await mutateCollection("artists", (artists) => {
      const index = artists.findIndex((artist) => artist.id === session.artistId || artist.userId === session.id);
      if (index < 0) throw new Error("artist_not_found");

      const updatedArtist = {
        ...artists[index],
        subscription,
        acceptsCommissions: true,
      };
      const nextArtists = [...artists];
      nextArtists[index] = updatedArtist;
      return { items: nextArtists, result: updatedArtist };
    });

    return withContentEtag(
      NextResponse.json({ ok: true, subscription, artist: updatedArtist }, withNoStore()),
      etag,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "artist_not_found") {
      return NextResponse.json({ ok: false, error: "artist_not_found" }, withNoStore({ status: 404 }));
    }
    console.error("Failed to update artist subscription", error);
    return NextResponse.json({ ok: false, error: "subscription_update_failed" }, withNoStore({ status: 500 }));
  }
}
