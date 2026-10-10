"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, LoaderCircle, Send, Smartphone, X } from "lucide-react";
import { secureFetch } from "@/lib/security/csrf-client";
import { cn } from "@/lib/utils";

type PushConfig = { configured: boolean; publicKey: string; devices: number };
type Notice = { kind: "success" | "error" | "info"; text: string };

function applicationServerKey(base64UrlKey: string): ArrayBuffer {
  const base64 = base64UrlKey.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function AdminPushControl() {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState<"load" | "enable" | "disable" | "test" | null>("load");
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = useCallback(async () => {
    setBusy("load");
    try {
      const response = await fetch("/api/admin/push", { credentials: "include", cache: "no-store" });
      const result = await response.json() as { ok?: boolean; configured?: boolean; publicKey?: string; devices?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "load_failed");
      setConfig({
        configured: Boolean(result.configured),
        publicKey: result.publicKey ?? "",
        devices: result.devices ?? 0,
      });

      const canPush = typeof window !== "undefined"
        && "serviceWorker" in navigator
        && "PushManager" in window
        && "Notification" in window
        && window.isSecureContext;
      setSupported(canPush);
      if (!canPush) {
        setPermission("unsupported");
        setSubscribed(false);
        return;
      }

      setPermission(Notification.permission);
      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      const subscription = await registration?.pushManager.getSubscription();
      setSubscribed(Boolean(subscription));

      // If a browser already has a local subscription, ensure it is also recorded
      // server-side (e.g. a prior save failed during a short network interruption).
      if (subscription && result.configured) {
        const synced = await secureFetch("/api/admin/push", {
          method: "POST",
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        if (synced.ok) {
          const saved = await synced.json() as { devices?: number };
          setConfig((current) => current ? { ...current, devices: saved.devices ?? current.devices } : current);
        }
      }
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error && error.message === "unauthorized"
        ? "برای مدیریت اعلان‌ها وارد حساب ادمین شوید."
        : "وضعیت اعلان‌ها دریافت نشد؛ اتصال را بررسی و دوباره تلاش کنید." });
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setNotice(null);
    if (!supported || !config?.configured || !config.publicKey) {
      setNotice({ kind: "error", text: "اعلان مستقیم هنوز در تنظیمات سرور فعال نشده است." });
      return;
    }
    if (isIosDevice() && !isStandaloneApp()) {
      setNotice({ kind: "info", text: "در iPhone ابتدا پنل را از Safari به صفحهٔ اصلی اضافه و از همان آیکن باز کنید." });
      return;
    }

    setBusy("enable");
    try {
      const permissionResult = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        throw new Error(permissionResult === "denied" ? "permission_denied" : "permission_not_granted");
      }

      let registration = await navigator.serviceWorker.getRegistration("/admin/");
      if (!registration) {
        registration = await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
      }
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(config.publicKey),
        });

      const response = await secureFetch("/api/admin/push", {
        method: "POST",
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; devices?: number };
      if (!response.ok || !result.ok) throw new Error(result.error || "subscribe_failed");

      setSubscribed(true);
      setConfig((current) => current ? { ...current, devices: result.devices ?? current.devices } : current);
      setNotice({ kind: "success", text: "اعلان‌های این گوشی فعال شد. برای اطمینان یک اعلان آزمایشی بفرستید." });
    } catch (error) {
      const code = error instanceof Error ? error.message : "subscribe_failed";
      const text = code === "permission_denied"
        ? "اجازهٔ اعلان رد شده است؛ آن را از تنظیمات مرورگر یا گوشی فعال کنید."
        : code === "device_limit"
          ? "حداکثر ۸ گوشی برای این حساب ثبت شده است. ابتدا یکی را غیرفعال کنید."
          : code === "push_not_configured"
            ? "کلیدهای امن اعلان هنوز در تنظیمات سرور قرار نگرفته‌اند."
            : "فعال‌سازی اعلان کامل نشد؛ HTTPS، نصب برنامه و اجازهٔ اعلان را بررسی کنید.";
      setNotice({ kind: "error", text });
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    setNotice(null);
    setBusy("disable");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await secureFetch("/api/admin/push", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("unsubscribe_failed");
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      await refresh();
      setNotice({ kind: "success", text: "اعلان‌های این گوشی غیرفعال شد." });
    } catch {
      setNotice({ kind: "error", text: "غیرفعال‌سازی اعلان انجام نشد؛ دوباره تلاش کنید." });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setNotice(null);
    setBusy("test");
    try {
      const response = await secureFetch("/api/admin/push/test", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const result = await response.json() as { ok?: boolean; sent?: number; failed?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "test_failed");
      setNotice(result.sent
        ? { kind: "success", text: "اعلان آزمایشی ارسال شد؛ ممکن است چند ثانیه طول بکشد تا روی گوشی نمایش داده شود." }
        : { kind: "error", text: "اعلانی تحویل نشد. ثبت گوشی و تنظیمات اعلان را بررسی کنید." });
    } catch {
      setNotice({ kind: "error", text: "ارسال اعلان آزمایشی ناموفق بود؛ اتصال گوشی و تنظیمات سرور را بررسی کنید." });
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;
  const statusLabel = busy === "load"
    ? "در حال بررسی"
    : subscribed
      ? "فعال روی این گوشی"
      : config && !config.configured
        ? "نیازمند راه‌اندازی"
        : "خاموش";

  return (
    <section className="mb-5 rounded-2xl border border-border bg-white p-4 shadow-soft sm:p-5" aria-labelledby="admin-push-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="admin-push-heading" className="text-sm font-bold text-foreground">هشدارهای گوشی</h2>
              <span className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                subscribed ? "bg-success/10 text-success" : config && !config.configured ? "bg-warning/10 text-warning" : "bg-background-secondary text-foreground-secondary",
              )}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs leading-6 text-foreground-secondary">
              پس از فعال‌سازی، ثبت‌نام جدید، ثبت سفارش و پرداخت موفق به‌صورت اعلان روی گوشی می‌آید.
              {config?.devices ? ` ${config.devices} دستگاه ثبت شده است.` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {subscribed ? (
            <>
              <button
                type="button"
                onClick={() => void test()}
                disabled={isBusy}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {busy === "test" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                اعلان آزمایشی
              </button>
              <button
                type="button"
                onClick={() => void disable()}
                disabled={isBusy}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground-secondary disabled:opacity-50"
              >
                {busy === "disable" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                خاموش‌کردن
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={isBusy || !config?.configured || !supported}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#1e2230] px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "enable" || busy === "load"
                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                : <Smartphone className="h-4 w-4" />}
              فعال‌سازی اعلان‌ها
            </button>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isBusy}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground-secondary disabled:opacity-50"
            aria-label="بررسی دوبارهٔ وضعیت اعلان‌ها"
          >
            {busy === "load" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            بررسی
          </button>
        </div>
      </div>

      {config && !config.configured && (
        <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-6 text-foreground-secondary">
          برای روشن‌شدن اعلان‌ها، یک‌بار کلیدهای امن Push در تنظیمات سرور ثبت می‌شوند. راهنمای تولید کلید در فایل MOBILE-ADMIN-PWA.md آمده است.
        </p>
      )}
      {config?.configured && !supported && busy !== "load" && (
        <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-6 text-foreground-secondary">
          این مرورگر اعلان مستقیم را پشتیبانی نمی‌کند؛ از Chrome در Android یا اپ نصب‌شدهٔ پنل در iPhone استفاده کنید.
        </p>
      )}
      {permission === "denied" && !subscribed && (
        <p className="mt-3 rounded-xl bg-error/10 px-3 py-2 text-xs leading-6 text-error">
          اجازهٔ اعلان در مرورگر بسته است؛ آن را از تنظیمات اعلان‌های مرورگر یا گوشی باز کنید.
        </p>
      )}
      {notice && (
        <p
          className={cn(
            "mt-3 rounded-xl px-3 py-2 text-xs leading-6",
            notice.kind === "success" ? "bg-success/10 text-success" : notice.kind === "error" ? "bg-error/10 text-error" : "bg-accent/10 text-accent",
          )}
          role="status"
          aria-live="polite"
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}
