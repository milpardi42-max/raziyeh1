"use client";

import { useEffect, useState } from "react";
import { Bell, Share2, X } from "lucide-react";

/** Install/update helper is mounted in the admin layout so it also works on
 * the login and marketplace-console routes, not just the main dashboard. */
export function PwaInstallPrompt() {
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const onInstallable = () => setInstallable(true);
    const onInstalled = () => {
      setInstalled(true);
      setInstallable(false);
      setIos(false);
    };
    const onUpdate = () => setShowUpdate(true);

    window.addEventListener("ra-pwa-installable", onInstallable);
    window.addEventListener("ra-pwa-installed", onInstalled);
    window.addEventListener("ra-pwa-update", onUpdate);

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(isStandalone);

    const isIosDevice =
      /iPad|iPhone|iPod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    if (isIosDevice && !isStandalone) setIos(true);

    return () => {
      window.removeEventListener("ra-pwa-installable", onInstallable);
      window.removeEventListener("ra-pwa-installed", onInstalled);
      window.removeEventListener("ra-pwa-update", onUpdate);
    };
  }, []);

  const install = async () => {
    const prompt = (window as unknown as {
      __deferredInstallPrompt?: {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
    }).__deferredInstallPrompt;
    if (!prompt) return;

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallable(false);
    } catch {
      setInstallable(false);
    }
  };

  if (installed || dismissed || (!installable && !ios && !showUpdate)) return null;

  return (
    <div className="fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-[80] mx-auto max-w-md space-y-2 lg:hidden">
      {(installable || ios) && !installed && (
        <section className="rounded-2xl border border-accent/25 bg-white p-3 shadow-xl" aria-label="نصب پنل مدیریت">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">نصب پنل مدیریت روی گوشی</p>
              {ios ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-6 text-foreground-secondary">
                  <Share2 className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" />
                  از منوی «اشتراک‌گذاری» مرورگر، «افزودن به صفحهٔ اصلی» را انتخاب کنید.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-5 text-foreground-secondary">
                  دسترسی سریع به مدیریت سایت، فروشگاه و آکادمی.
                </p>
              )}
            </div>
            {!ios && installable && (
              <button
                type="button"
                onClick={() => void install()}
                className="min-h-[44px] shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white"
              >
                نصب
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 p-2 text-muted"
              aria-label="بستن پیام نصب"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {showUpdate && (
        <section className="rounded-2xl border border-white/10 bg-[#1e2230] p-3 text-white shadow-xl" aria-label="به‌روزرسانی پنل">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 shrink-0 text-accent" />
            <p className="min-w-0 flex-1 text-xs">نسخهٔ جدید پنل آماده است.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[40px] shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white"
            >
              به‌روزرسانی
            </button>
            <button
              type="button"
              onClick={() => setShowUpdate(false)}
              className="shrink-0 p-1 text-white/70"
              aria-label="بستن پیام به‌روزرسانی"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
