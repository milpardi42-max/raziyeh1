import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAllReservations, updateReservationAccess, updateReservationStatus } from "@/lib/data/reservations";
import { getContent } from "@/lib/data/store";
import { isFreePrice } from "@/lib/academy-live";
import type { ReservationStatus } from "@/lib/types";
import { withNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }
  const [stored, content] = await Promise.all([getAllReservations(), getContent()]);
  const reservations = stored.map((reservation) => {
    if (reservation.paymentRequired !== undefined) return reservation;
    const item = content.education.find((entry) => entry.slug === reservation.eventSlug);
    return { ...reservation, paymentRequired: item ? !isFreePrice(item.price) : false };
  });
  reservations.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return NextResponse.json({ ok: true, reservations }, withNoStore());
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }

  let body: { id?: unknown; status?: unknown; accessGranted?: unknown };
  try {
    body = await request.json() as { id?: unknown; status?: unknown; accessGranted?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, withNoStore({ status: 400 }));
  }
  if (typeof body.id !== "string") {
    return NextResponse.json({ ok: false, error: "invalid_reservation" }, withNoStore({ status: 400 }));
  }
  const allowed: ReservationStatus[] = ["reserved", "cancelled", "attended"];
  const reservation = typeof body.accessGranted === "boolean"
    ? await updateReservationAccess(body.id, body.accessGranted)
    : allowed.includes(body.status as ReservationStatus)
      ? await updateReservationStatus(body.id, body.status as ReservationStatus)
      : null;
  if (!allowed.includes(body.status as ReservationStatus) && typeof body.accessGranted !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_reservation_update" }, withNoStore({ status: 400 }));
  }

  if (!reservation) {
    return NextResponse.json({ ok: false, error: "reservation_not_found" }, withNoStore({ status: 404 }));
  }
  return NextResponse.json({ ok: true, reservation }, withNoStore());
}