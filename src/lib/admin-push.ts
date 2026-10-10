import "server-only";

import * as webPush from "web-push";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { KEYS, mutateCollection, readCollection } from "@/lib/marketplace/store";

export interface AdminPushDevice {
  adminId: string;
  subscription: WebPushSubscription;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const MAX_DEVICES_PER_ADMIN = 8;
const TTL_SECONDS = 60 * 60;
const ALLOWED_ENDPOINT_HOSTS = [
  "fcm.googleapis.com",
  "web.push.apple.com",
  "push.services.mozilla.com",
];

function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_ENDPOINT_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
      || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

/** Validates browser input and limits server-side push delivery to known push services. */
export function parseAdminPushSubscription(value: unknown): WebPushSubscription | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    endpoint?: unknown;
    expirationTime?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (typeof candidate.endpoint !== "string" || candidate.endpoint.length > 2048) return null;
  if (!isAllowedEndpoint(candidate.endpoint)) return null;
  if (typeof candidate.keys?.p256dh !== "string" || candidate.keys.p256dh.length > 256) return null;
  if (typeof candidate.keys?.auth !== "string" || candidate.keys.auth.length > 128) return null;
  if (!candidate.keys.p256dh || !candidate.keys.auth) return null;

  return {
    endpoint: candidate.endpoint,
    expirationTime: typeof candidate.expirationTime === "number" ? candidate.expirationTime : null,
    keys: { p256dh: candidate.keys.p256dh, auth: candidate.keys.auth },
  };
}

export function adminPushConfig() {
  const publicKey = process.env.ADMIN_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.ADMIN_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.ADMIN_PUSH_VAPID_SUBJECT?.trim()
    || `mailto:${process.env.ADMIN_EMAIL?.trim() || "admin@rosieatelier.com"}`;
  return { configured: Boolean(publicKey && privateKey), publicKey, privateKey, subject };
}

export async function listAdminPushDevices(adminId?: string): Promise<AdminPushDevice[]> {
  const devices = await readCollection<AdminPushDevice>(KEYS.adminPush);
  return adminId ? devices.filter((device) => device.adminId === adminId) : devices;
}

export async function saveAdminPushDevice(
  adminId: string,
  subscription: WebPushSubscription,
): Promise<{ count: number; saved: boolean }> {
  const now = new Date().toISOString();
  return mutateCollection<AdminPushDevice, { count: number; saved: boolean }>(KEYS.adminPush, (devices) => {
    const existingIndex = devices.findIndex((device) => device.subscription.endpoint === subscription.endpoint);
    const existing = existingIndex >= 0 ? devices[existingIndex] : null;
    const ownedCount = devices.filter((device) => device.adminId === adminId).length;
    if (!existing && ownedCount >= MAX_DEVICES_PER_ADMIN) {
      return { result: { count: ownedCount, saved: false } };
    }

    const record: AdminPushDevice = {
      adminId,
      subscription,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = devices.slice();
    if (existingIndex >= 0) next[existingIndex] = record;
    else next.push(record);
    return {
      next,
      result: { count: next.filter((device) => device.adminId === adminId).length, saved: true },
    };
  });
}

export async function removeAdminPushDevice(
  adminId: string,
  endpoint: string,
): Promise<{ count: number; removed: boolean }> {
  return mutateCollection<AdminPushDevice, { count: number; removed: boolean }>(KEYS.adminPush, (devices) => {
    const next = devices.filter(
      (device) => !(device.adminId === adminId && device.subscription.endpoint === endpoint),
    );
    return {
      ...(next.length !== devices.length ? { next } : {}),
      result: {
        count: next.filter((device) => device.adminId === adminId).length,
        removed: next.length !== devices.length,
      },
    };
  });
}

/**
 * Sends one small, private admin alert to every enrolled admin device.
 * Delivery failures never affect the signup/payment transaction. Expired browser
 * subscriptions are removed automatically (Web Push status 404/410).
 */
export async function sendAdminPush(
  message: AdminPushMessage,
  options: { adminId?: string } = {},
): Promise<{ configured: boolean; sent: number; failed: number }> {
  const config = adminPushConfig();
  if (!config.configured) return { configured: false, sent: 0, failed: 0 };

  const devices = await listAdminPushDevices(options.adminId);
  if (!devices.length) return { configured: true, sent: 0, failed: 0 };

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const url = message.url.startsWith("/admin/") ? message.url : "/admin/fa";
  const payload = JSON.stringify({
    title: message.title.slice(0, 100),
    body: message.body.slice(0, 240),
    url: url.slice(0, 300),
    tag: message.tag.slice(0, 100),
    dir: "rtl",
    lang: "fa",
  });

  const outcomes = await Promise.all(devices.map(async (device) => {
    try {
      await webPush.sendNotification(device.subscription, payload, {
        TTL: TTL_SECONDS,
        urgency: "high",
        timeout: 5_000,
      });
      return "sent" as const;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await removeAdminPushDevice(device.adminId, device.subscription.endpoint).catch(() => undefined);
      }
      return "failed" as const;
    }
  }));

  return {
    configured: true,
    sent: outcomes.filter((outcome) => outcome === "sent").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  };
}

/** Best-effort event hook: alert delivery must never roll back a signup or payment. */
export async function sendAdminPushSafely(message: AdminPushMessage): Promise<void> {
  try {
    await sendAdminPush(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    console.warn(`[admin-push] notification delivery failed: ${reason}`);
  }
}
