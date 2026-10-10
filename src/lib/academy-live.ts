import type { AcademyReservation, LiveEventConfig, LiveEventStatus } from "./types";
import type { SessionUser } from "./session";

/** Expire elapsed events without ever inferring that a scheduled event is actually streaming. */
export function effectiveLiveStatus(
  event: Pick<LiveEventConfig, "status" | "startsAt" | "durationMin"> | null | undefined,
  now = Date.now(),
): LiveEventStatus | null {
  if (!event) return null;
  if (event.status === "cancelled" || event.status === "ended") return event.status;
  const startsAt = Date.parse(event.startsAt);
  const durationMin = Number.isFinite(event.durationMin) ? Math.max(0, event.durationMin) : 0;
  if (Number.isFinite(startsAt)) {
    const endsAt = startsAt + durationMin * 60_000;
    if (endsAt <= now) return "ended";
  }
  return event.status;
}

export function isFreePrice(price: { fa: number; en: number } | undefined): boolean {
  return !price || (price.fa <= 0 && price.en <= 0);
}

/** Only public HTTPS endpoints may be used as third-party meeting or HLS sources. */
export function safeExternalHttpsUrl(value: string | undefined): URL | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const octets = ipv4.slice(1).map(Number);
      if (octets.some((part) => part < 0 || part > 255)) return null;
      const [a, b] = octets;
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
        || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19))) return null;
    }
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return null;
    return url;
  } catch {
    return null;
  }
}

/** A granted, non-cancelled reservation is the only non-admin entitlement for private media. */
export function hasGrantedReservation(
  reservations: AcademyReservation[],
  slug: string,
  session: SessionUser | null,
): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  const email = session.email.trim().toLowerCase();
  return reservations.some((reservation) =>
    reservation.eventSlug === slug &&
    reservation.status !== "cancelled" &&
    reservation.accessGranted === true &&
    (reservation.userId === session.id || reservation.email.trim().toLowerCase() === email),
  );
}

export function mayJoinLiveEvent(
  event: Pick<LiveEventConfig, "status" | "startsAt" | "durationMin"> | null | undefined,
  now = Date.now(),
): boolean {
  const status = effectiveLiveStatus(event, now);
  return status === "scheduled" || status === "live";
}
