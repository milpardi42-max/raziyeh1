import { NextResponse } from "next/server";
import { withNoStore } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { effectiveLiveStatus, isFreePrice } from "@/lib/academy-live";
import { getContent } from "@/lib/data/store";
import { createReservation } from "@/lib/data/reservations";
import { clientIp, recordAttempt, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";

/**
 * POST /api/academy/enroll
 *
 * The academy page's registration endpoint. It stores a real registration in the
 * reservations store (`data/reservations.json`), which is what the admin panel's
 * «رزرو رویدادها» list and the academy counters read.
 *
 *   · course            → self-paced enrollment, unlimited, no schedule
 *   · workshop/webinar  → seat in a live event, bounded by `liveEvent.capacity`
 *
 * Body: { slug, name, email }
 */
export async function POST(req: Request) {
  const key = `academy-enroll:${clientIp(req)}`;
  if (tooManyAttempts(key)) {
    const wait = retryAfterSeconds(key);
    const res = NextResponse.json({ ok: false, error: "too_many_attempts", retryAfter: wait }, withNoStore({ status: 429 }));
    if (wait > 0) res.headers.set("Retry-After", String(wait));
    return res;
  }
  recordAttempt(key);

  const body = (await req.json().catch(() => null)) as
    | { slug?: string; name?: string; email?: string }
    | null;

  const slug = body?.slug?.trim();
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();

  if (!slug || !name || name.length < 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  const site = await getContent();
  const item = site.education.find((entry) => entry.slug === slug);
  if (!item) {
    return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
  }

  const session = await getSession();
  const status = effectiveLiveStatus(item.liveEvent);
  if (status === "ended" || status === "cancelled") {
    return NextResponse.json({ ok: false, error: "event_closed" }, withNoStore({ status: 409 }));
  }

  try {
    const reservation = await createReservation({
      eventSlug: item.slug,
      eventType: item.type === "course" ? "course" : item.type,
      eventTitle: item.title,
      startsAt: item.liveEvent?.startsAt ?? new Date().toISOString(),
      capacity: item.type === "course" ? 0 : item.liveEvent?.capacity ?? 0,
      userId: session?.id,
      name,
      email,
      // Free content is immediately available. Paid access is manually granted after payment verification.
      accessGranted: isFreePrice(item.price),
      paymentRequired: !isFreePrice(item.price),
    });

    return NextResponse.json(
      {
        ok: true,
        enrollment: {
          id: reservation.id,
          slug: item.slug,
          title: item.title,
          type: item.type,
          startsAt: reservation.startsAt,
          status: reservation.status,
          accessGranted: reservation.accessGranted === true,
          /* A priced course is a paid seat: access stays closed until an admin verifies payment. */
          paymentDue: !isFreePrice(item.price) && reservation.accessGranted !== true,
        },
      },
      withNoStore(),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "event_full") {
      return NextResponse.json({ ok: false, error: "event_full" }, withNoStore({ status: 409 }));
    }
    console.error("[academy/enroll] failed:", error);
    return NextResponse.json({ ok: false, error: "server_error" }, withNoStore({ status: 500 }));
  }
}
