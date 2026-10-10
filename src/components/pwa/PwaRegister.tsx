"use client";

import { useEffect } from "react";

/**
 * Registers the admin PWA service worker and exposes install/update state
 * on `window` so other components (e.g. the install prompt) can react.
 *
 * Events dispatched on `window`:
 *   • "ra-pwa-installable"  — the browser offered installation (beforeinstallprompt)
 *   • "ra-pwa-installed"    — the user completed installation
 *   • "ra-pwa-update"       — a new service worker is waiting
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // SW only in prod builds

    const register = async () => {
      try {
        // Keep the worker confined to the admin app; never intercept the public site.
        const reg = await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });

        // Update flow: a new SW is waiting → tell the UI
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("ra-pwa-update"));
            }
          });
        });
      } catch (error) {
        console.warn("[pwa] service worker registration failed:", error);
      }
    };

    // Install prompt capture
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = e;
      window.dispatchEvent(new CustomEvent("ra-pwa-installable"));
    };
    const onInstalled = () => {
      (window as unknown as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = undefined;
      window.dispatchEvent(new CustomEvent("ra-pwa-installed"));
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    void register();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
