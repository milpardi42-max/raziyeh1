/* ─────────────────────────────────────────────────────────────
 * Rosie Atelier Admin PWA service worker
 * Scope: /admin/ only. Admin HTML and every API/auth request are
 * deliberately network-only: no private dashboard data is persisted
 * in Cache Storage on a lost or shared phone.
 * ───────────────────────────────────────────────────────────── */

const VERSION = "ra-admin-v3";
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("ra-admin-") && !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache admin pages, API responses, login/session data, or mutations.
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) return;

  // Public, versioned Next.js bundles and the app's public icons are safe to cache.
  const isVersionedAsset = url.pathname.startsWith("/_next/static/");
  const isAppIcon = url.pathname.startsWith("/icons/");
  if (!isVersionedAsset && !isAppIcon) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        void cache.put(request, copy);
      }
      return response;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

/* Push notification received while the app is closed or in the background. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof payload.title === "string" ? payload.title : "آتلیه رزی";
  const body = typeof payload.body === "string" ? payload.body : "یک رویداد جدید در پنل مدیریت دارید.";
  const requestedUrl = typeof payload.url === "string" ? payload.url : "/admin/fa";
  let target;
  try {
    target = new URL(requestedUrl, self.location.origin);
  } catch {
    target = new URL("/admin/fa", self.location.origin);
  }
  if (target.origin !== self.location.origin || !target.pathname.startsWith("/admin/")) {
    target = new URL("/admin/fa", self.location.origin);
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      tag: typeof payload.tag === "string" ? payload.tag : "rosie-admin-alert",
      dir: "rtl",
      lang: "fa",
      renotify: false,
      data: { url: `${target.pathname}${target.search}` },
    }),
  );
});

/* Tapping an alert opens the relevant authenticated admin section. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data && event.notification.data.url;
  let target;
  try {
    target = new URL(typeof requestedUrl === "string" ? requestedUrl : "/admin/fa", self.location.origin);
  } catch {
    target = new URL("/admin/fa", self.location.origin);
  }
  if (target.origin !== self.location.origin || !target.pathname.startsWith("/admin/")) {
    target = new URL("/admin/fa", self.location.origin);
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => {
        const clientUrl = new URL(client.url);
        return clientUrl.origin === self.location.origin && clientUrl.pathname.startsWith("/admin/");
      });
      if (existing && "navigate" in existing && "focus" in existing) {
        return existing.navigate(target.href).then((windowClient) => windowClient?.focus());
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
