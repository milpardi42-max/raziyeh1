import type { AnnouncementBarConfig, EducationItem } from "@/lib/types";

export type AnnouncementBarPreviewState = "nothing" | "waiting" | "live-webinar" | "config";
export type AnnouncementBarRowState = "off" | "expired" | "waiting" | "showing" | "queued";

function hasLiveEvent(event: EducationItem | null): boolean {
  return event?.liveEvent?.status === "live";
}

export function isAnnouncementBarExpired(bar: AnnouncementBarConfig, now = Date.now()): boolean {
  if (bar.kind === "live-webinar" || !bar.expiresAt) return false;
  const expiry = Date.parse(bar.expiresAt);
  // An invalid configured expiry must not leave a bar active indefinitely.
  return !Number.isFinite(expiry) || expiry <= now;
}

export function selectAnnouncementBar(
  bars: readonly AnnouncementBarConfig[],
  event: EducationItem | null,
  now = Date.now(),
  excludedIds: ReadonlySet<string> = new Set(),
): AnnouncementBarConfig | null {
  return bars.find((bar) =>
    bar.enabled
    && !excludedIds.has(bar.id)
    && !isAnnouncementBarExpired(bar, now)
    && (bar.kind !== "live-webinar" || hasLiveEvent(event)),
  ) ?? null;
}

export function getAnnouncementBarPreview(
  bars: readonly AnnouncementBarConfig[],
  event: EducationItem | null,
  now = Date.now(),
): { state: AnnouncementBarPreviewState; bar: AnnouncementBarConfig | null } {
  const selected = selectAnnouncementBar(bars, event, now);
  if (selected) {
    return {
      state: selected.kind === "live-webinar" ? "live-webinar" : "config",
      bar: selected,
    };
  }

  const waiting = bars.find((bar) =>
    bar.enabled
    && bar.kind === "live-webinar"
    && !isAnnouncementBarExpired(bar, now)
    && !hasLiveEvent(event),
  ) ?? null;
  return waiting ? { state: "waiting", bar: waiting } : { state: "nothing", bar: null };
}

export function getAnnouncementBarRowState(
  bar: AnnouncementBarConfig,
  bars: readonly AnnouncementBarConfig[],
  event: EducationItem | null,
  now = Date.now(),
): AnnouncementBarRowState {
  if (!bar.enabled) return "off";
  if (isAnnouncementBarExpired(bar, now)) return "expired";
  if (bar.kind === "live-webinar" && !hasLiveEvent(event)) return "waiting";
  return selectAnnouncementBar(bars, event, now) === bar ? "showing" : "queued";
}

/** Enabling a bar makes it the single configured active bar; disabling leaves others unchanged. */
export function setSingleEnabledAnnouncementBar(
  bars: readonly AnnouncementBarConfig[],
  id: string,
  enabled: boolean,
): AnnouncementBarConfig[] {
  return bars.map((bar) => ({
    ...bar,
    enabled: bar.id === id ? enabled : enabled ? false : bar.enabled,
  }));
}

export function getNextAnnouncementBarExpiryAt(
  bars: readonly AnnouncementBarConfig[],
  now = Date.now(),
): number | null {
  const expiries = bars
    .filter((bar) => bar.enabled && bar.kind !== "live-webinar" && Boolean(bar.expiresAt))
    .map((bar) => Date.parse(bar.expiresAt!))
    .filter((expiry) => Number.isFinite(expiry) && expiry > now);
  return expiries.length ? Math.min(...expiries) : null;
}
