"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  Calculator,
  Check,
  Coins,
  CreditCard,
  Crown,
  DollarSign,
  Edit2,
  FileSpreadsheet,
  Filter,
  Layers,
  Loader2,
  Lock,
  Paintbrush,
  Palette,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { faNum, formatNumber, formatPrice, t } from "@/lib/utils";
import type { Artist, FinancialConfig, Pattern, Product, SiteContent } from "@/lib/types";

interface FinancialManagerProps {
  data: SiteContent;
  update: (patch: Partial<SiteContent>) => void;
  onSave?: () => Promise<void>;
}

type FinancialTab = "commission" | "subscriptions" | "artists" | "pricing-hub" | "rules";

export function FinancialManager({ data, update, onSave }: FinancialManagerProps) {
  const [activeTab, setActiveTab] = useState<FinancialTab>("commission");
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Search & Filter for Artist table
  const [artistSearch, setArtistSearch] = useState("");

  // Search & Filter for Pricing Hub
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogType, setCatalogType] = useState<"all" | "patterns" | "products" | "services">("all");

  const config: FinancialConfig = useMemo(() => {
    return (
      data.financialConfig ?? {
        defaultCommissionPct: 30,
        defaultArtistSharePct: 70,
        directCommissionPct: 0,
        subscriptionPricing: {
          proMonthly: { fa: 290000, en: 9 },
          proAnnual: { fa: 2900000, en: 90 },
          studioMonthly: { fa: 690000, en: 24 },
          studioAnnual: { fa: 6900000, en: 240 },
        },
        minPayoutFa: 500000,
        minPayoutEn: 25,
        vatPct: 9,
        affiliateCommissionPct: 10,
        freeShippingThresholdFa: 2000000,
      }
    );
  }, [data.financialConfig]);

  const updateConfig = (patch: Partial<FinancialConfig>) => {
    const updated: FinancialConfig = {
      ...config,
      ...patch,
    };
    update({
      financialConfig: updated,
    });
  };

  const handleManualSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch {
      alert("خطا در ذخیره تنظیمات مالی.");
    } finally {
      setSaving(false);
    }
  };

  // Update specific artist share percentage
  const handleArtistShareChange = (artistId: string, sharePct: number) => {
    const clamped = Math.max(0, Math.min(100, sharePct));
    update({
      artists: data.artists.map((a) =>
        a.id === artistId ? { ...a, revenueSharePct: clamped } : a,
      ),
    });
  };

  // Quick edit pattern price
  const handlePatternPriceChange = (patternId: string, faPrice: number, enPrice?: number) => {
    update({
      patterns: data.patterns.map((p) =>
        p.id === patternId
          ? {
              ...p,
              price: {
                fa: Math.max(0, faPrice),
                en: enPrice !== undefined ? Math.max(0, enPrice) : Math.round(faPrice / 25000),
              },
            }
          : p,
      ),
    });
  };

  // Quick edit product price
  const handleProductPriceChange = (productId: string, faPrice: number, enPrice?: number) => {
    update({
      products: data.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              price: {
                fa: Math.max(0, faPrice),
                en: enPrice !== undefined ? Math.max(0, enPrice) : Math.round(faPrice / 25000),
              },
            }
          : p,
      ),
    });
  };

  // Quick edit service price
  const handleServicePriceChange = (artistId: string, serviceId: string, faPrice: number, enPrice?: number) => {
    update({
      artists: data.artists.map((a) => {
        if (a.id !== artistId || !a.services) return a;
        return {
          ...a,
          services: a.services.map((s) =>
            s.id === serviceId
              ? {
                  ...s,
                  price: {
                    fa: Math.max(0, faPrice),
                    en: enPrice !== undefined ? Math.max(0, enPrice) : Math.round(faPrice / 25000),
                  },
                }
              : s,
          ),
        };
      }),
    });
  };

  // Filtered artists
  const filteredArtists = useMemo(() => {
    return data.artists.filter((a) => {
      if (!artistSearch.trim()) return true;
      const q = artistSearch.toLowerCase().trim();
      const name = (t(a.name, "fa") + " " + t(a.name, "en")).toLowerCase();
      const prof = (t(a.profession, "fa") + " " + t(a.profession, "en")).toLowerCase();
      return name.includes(q) || prof.includes(q);
    });
  }, [data.artists, artistSearch]);

  // Combined Catalog items for pricing hub
  const catalogItems = useMemo(() => {
    const items: {
      id: string;
      type: "pattern" | "product" | "service";
      title: string;
      image: string;
      artistName: string;
      artistId?: string;
      price: { fa: number; en: number };
      skuOrCat: string;
    }[] = [];

    if (catalogType === "all" || catalogType === "patterns") {
      data.patterns.forEach((p) => {
        const artist = data.artists.find((a) => a.id === p.artistId);
        items.push({
          id: p.id,
          type: "pattern",
          title: t(p.title, "fa"),
          image: p.image,
          artistName: artist ? t(artist.name, "fa") : "آتلیه رزی",
          artistId: p.artistId ?? undefined,
          price: p.price,
          skuOrCat: p.sku || "پترن دیجیتال",
        });
      });
    }

    if (catalogType === "all" || catalogType === "products") {
      data.products.forEach((pr) => {
        const artist = data.artists.find((a) => a.id === pr.artistId);
        items.push({
          id: pr.id,
          type: "product",
          title: t(pr.title, "fa"),
          image: pr.colors?.[0]?.image || "/images/products/curtain-linen.jpg",
          artistName: artist ? t(artist.name, "fa") : "آتلیه رزی",
          artistId: pr.artistId ?? undefined,
          price: pr.price,
          skuOrCat: pr.sku || "محصول فروشگاه",
        });
      });
    }

    if (catalogType === "all" || catalogType === "services") {
      data.artists.forEach((art) => {
        (art.services ?? []).forEach((srv) => {
          items.push({
            id: srv.id,
            type: "service",
            title: t(srv.title, "fa"),
            image: srv.image,
            artistName: t(art.name, "fa"),
            artistId: art.id,
            price: srv.price,
            skuOrCat: t(srv.categoryLabel ?? { fa: "خدمت پتینه/هنر", en: "Service" }, "fa"),
          });
        });
      });
    }

    if (!catalogSearch.trim()) return items;
    const q = catalogSearch.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.artistName.toLowerCase().includes(q) ||
        item.skuOrCat.toLowerCase().includes(q),
    );
  }, [data, catalogType, catalogSearch]);

  return (
    <div className="space-y-6 pb-16">
      {/* ══ Header ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-foreground">
                تنظیمات جامع مالی، کمیسیون‌ها و تعرفه‌های سایت
              </h1>
              <Badge tone="accent">مدیریت مالی</Badge>
            </div>
            <p className="mt-0.5 text-xs text-foreground-secondary">
              بررسی و کنترل متمرکز درصد کمیسیون پلتفرم، سهم فروش طراحان، تعرفه خرید اشتراک‌ها و قیمت‌گذاری کاتالوگ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedNotice && (
            <span className="text-xs font-semibold text-success flex items-center gap-1 bg-success/10 px-3 py-1.5 rounded-full">
              <Check className="h-4 w-4" />
              ذخیره شد
            </span>
          )}
          <button
            type="button"
            onClick={handleManualSave}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-xs font-bold text-white shadow-medium transition hover:bg-accent/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>ذخیره کلیه تنظیمات مالی</span>
          </button>
        </div>
      </div>

      {/* ══ Top KPI Cards ══════════════════════════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Default Commission */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-secondary">کمیسیون پیش‌فرض پلتفرم</span>
            <Percent className="h-4 w-4 text-accent" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {faNum(config.defaultCommissionPct)}٪
            <span className="text-xs font-normal text-foreground-secondary ms-2">
              (سهم هنرمند: {faNum(config.defaultArtistSharePct)}٪)
            </span>
          </p>
            <p className="text-[11px] text-muted">سهم پیش‌فرض برای ثبت‌نام و آثار تازه؛ سهم ثبت‌شدهٔ آثار قبلی حفظ می‌شود.</p>
        </div>

        {/* Pro Subscription Price */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-secondary">تعرفه اشتراک Artist Pro</span>
            <Crown className="h-4 w-4 text-accent" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground tabular">
            {formatPrice(config.subscriptionPricing.proMonthly, "fa")}
            <span className="text-xs font-normal text-foreground-secondary ms-1">/ماهانه</span>
          </p>
          <p className="text-[11px] text-muted">
            سالانه: {formatPrice(config.subscriptionPricing.proAnnual, "fa")}
          </p>
        </div>

        {/* Studio VIP Subscription Price */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-secondary">تعرفه اشتراک Studio VIP</span>
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground tabular">
            {formatPrice(config.subscriptionPricing.studioMonthly, "fa")}
            <span className="text-xs font-normal text-foreground-secondary ms-1">/ماهانه</span>
          </p>
          <p className="text-[11px] text-muted">
            سالانه: {formatPrice(config.subscriptionPricing.studioAnnual, "fa")}
          </p>
        </div>

        {/* Payout & Direct Commissions */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-secondary">حداقل سقف تسویه حساب</span>
            <Wallet className="h-4 w-4 text-accent" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground tabular">
            {faNum(config.minPayoutFa.toLocaleString("fa-IR"))} تومان
          </p>
          <p className="text-[11px] text-muted">نرخ سیاستی پروژه مستقیم (پرداخت آنلاین فعال نیست): {faNum(config.directCommissionPct)}٪</p>
        </div>
      </div>

      {/* ══ Tab Navigation ══════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {[
          { id: "commission" as const, label: "کمیسیون و سهم فروش پلتفرم", icon: <Percent className="h-4 w-4" /> },
          { id: "subscriptions" as const, label: "تعرفه اشتراک‌های طراحان", icon: <Crown className="h-4 w-4" /> },
          { id: "artists" as const, label: `سهم اختصاصی طراحان (${data.artists.length})`, icon: <Users className="h-4 w-4" /> },
          { id: "pricing-hub" as const, label: "ویرایشگر جامع قیمت‌های کاتالوگ و خدمات", icon: <DollarSign className="h-4 w-4" /> },
          { id: "rules" as const, label: "تسویه حساب، مالیات و ارسال", icon: <Calculator className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-accent text-white shadow-sm"
                : "bg-surface text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1. COMMISSION & REVENUE SHARE SETTINGS                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "commission" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Default Platform Commission */}
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft space-y-5">
            <div>
              <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase">
                <Percent className="h-4 w-4" />
                <span>نرخ‌های پایه پلتفرم</span>
              </div>
              <h2 className="mt-1 font-display text-base font-bold text-foreground">
                تنظیم درصد کمیسیون پیش‌فرض مارکت‌پلیس
              </h2>
              <p className="mt-1 text-xs text-foreground-secondary leading-relaxed">
                این سهم برای طراحان تازه و آثار تازه‌ای که نرخ اختصاصی ندارند استفاده می‌شود. نرخ ذخیره‌شده روی آثار موجود برای جلوگیری از تغییر ناخواسته حفظ می‌شود.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">درصد کمیسیون پلتفرم آتلیه رزی</label>
                  <span className="text-xs font-bold text-accent tabular">{faNum(config.defaultCommissionPct)}٪</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={config.defaultCommissionPct}
                  onChange={(e) => {
                    const comm = Number(e.target.value);
                    updateConfig({
                      defaultCommissionPct: comm,
                      defaultArtistSharePct: 100 - comm,
                    });
                  }}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">سهم پرداختی به هنرمند (محاسبه خودکار)</label>
                  <span className="text-xs font-bold text-success tabular">{faNum(config.defaultArtistSharePct)}٪</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-background-secondary flex">
                  <div className="bg-success transition-all" style={{ width: `${config.defaultArtistSharePct}%` }} title="سهم هنرمند" />
                  <div className="bg-accent transition-all" style={{ width: `${config.defaultCommissionPct}%` }} title="کمیسیون پلتفرم" />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">مثال: در فروش ۱٬۰۰۰٬۰۰۰ تومانی</span>
                  <span className="font-bold text-foreground tabular">۱٬۰۰۰٬۰۰۰ تومان</span>
                </div>
                <div className="flex items-center justify-between text-success">
                  <span>سهم هنرمند طراح ({faNum(config.defaultArtistSharePct)}٪):</span>
                  <span className="font-bold tabular">{faNum((1000000 * config.defaultArtistSharePct / 100).toLocaleString("fa-IR"))} تومان</span>
                </div>
                <div className="flex items-center justify-between text-accent">
                  <span>درآمد پلتفرم ({faNum(config.defaultCommissionPct)}٪):</span>
                  <span className="font-bold tabular">{faNum((1000000 * config.defaultCommissionPct / 100).toLocaleString("fa-IR"))} تومان</span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Project & Affiliate Commission */}
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft space-y-5">
            <div>
              <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase">
                <Paintbrush className="h-4 w-4" />
                <span>سفارش‌های مستقیم و معرف</span>
              </div>
              <h2 className="mt-1 font-display text-base font-bold text-foreground">
                کارمزد خدمات پتینه، پروژه‌های اختصاصی و افیلیت
              </h2>
              <p className="mt-1 text-xs text-foreground-secondary leading-relaxed">
                پورسانت کدهای معرف روی فروش دیجیتال اعمال می‌شود؛ کارمزد پروژه مستقیم تا زمان راه‌اندازی پرداخت خدمات، فقط به‌عنوان سیاست ذخیره می‌شود.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  کارمزد قراردادهای مستقیم پتینه و اجرای سفارشی (درصد)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={config.directCommissionPct}
                    onChange={(e) => updateConfig({ directCommissionPct: Number(e.target.value) })}
                    className="h-10 w-32 rounded-xl border border-border bg-background px-3 text-xs font-bold focus:border-accent focus:outline-none"
                  />
                  <span className="text-xs text-foreground-secondary">
                    {config.directCommissionPct === 0 ? "نرخ ذخیره‌شده؛ پرداخت مستقیم خدمات فعال نیست." : `نرخ سیاستی ${faNum(config.directCommissionPct)}٪؛ فعلاً از سفارش آنلاین کسر نمی‌شود.`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  پورسانت سیستم همکاری در فروش / معرف (Affiliate Commission %)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={config.affiliateCommissionPct}
                  onChange={(e) => updateConfig({ affiliateCommissionPct: Number(e.target.value) })}
                  className="h-10 w-32 rounded-xl border border-border bg-background px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  مالیات بر ارزش افزوده قانونی (VAT %)
                </label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={config.vatPct}
                  onChange={(e) => updateConfig({ vatPct: Number(e.target.value) })}
                  className="h-10 w-32 rounded-xl border border-border bg-background px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 2. ARTIST PRO & VIP SUBSCRIPTION PRICING                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "subscriptions" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Plan: Artist Pro */}
          <div className="rounded-3xl border-2 border-accent bg-surface p-6 shadow-soft space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent">پلن اصلی طراحان</span>
                <h3 className="font-display text-lg font-bold text-foreground">پلن حرفه‌ای Artist Pro</h3>
              </div>
              <Badge tone="accent">پیشنهاد اصلی</Badge>
            </div>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              این تعرفه‌ها ذخیره می‌شوند، اما در حال حاضر خرید اشتراک Pro/Studio و پرداخت آن در سایت فعال نیست؛ تغییر این ارقام هزینه‌ای از کاربر دریافت نمی‌کند.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت ماهانه (تومان)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.proMonthly.fa}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        proMonthly: {
                          ...config.subscriptionPricing.proMonthly,
                          fa: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold text-accent focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">
                  نمایش: {formatPrice(config.subscriptionPricing.proMonthly, "fa")}
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت ماهانه (دلار)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.proMonthly.en}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        proMonthly: {
                          ...config.subscriptionPricing.proMonthly,
                          en: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">${config.subscriptionPricing.proMonthly.en} / mo</span>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت سالانه (تومان)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.proAnnual.fa}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        proAnnual: {
                          ...config.subscriptionPricing.proAnnual,
                          fa: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold text-accent focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">
                  نمایش: {formatPrice(config.subscriptionPricing.proAnnual, "fa")}
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت سالانه (دلار)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.proAnnual.en}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        proAnnual: {
                          ...config.subscriptionPricing.proAnnual,
                          en: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">${config.subscriptionPricing.proAnnual.en} / yr</span>
              </div>
            </div>
          </div>

          {/* Plan: Studio VIP */}
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">پلن استودیو و اساتید</span>
                <h3 className="font-display text-lg font-bold text-foreground">پلن استودیو VIP</h3>
              </div>
              <Badge tone="neutral">استودیو و اساتید</Badge>
            </div>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              تعرفه اشتراک اساتید برگزیده و استودیوها با امکان معرفی اختصاصی به پروژه‌های بزرگ معماری و هتل‌سازی.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت ماهانه (تومان)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.studioMonthly.fa}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        studioMonthly: {
                          ...config.subscriptionPricing.studioMonthly,
                          fa: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">
                  نمایش: {formatPrice(config.subscriptionPricing.studioMonthly, "fa")}
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت ماهانه (دلار)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.studioMonthly.en}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        studioMonthly: {
                          ...config.subscriptionPricing.studioMonthly,
                          en: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">${config.subscriptionPricing.studioMonthly.en} / mo</span>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت سالانه (تومان)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.studioAnnual.fa}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        studioAnnual: {
                          ...config.subscriptionPricing.studioAnnual,
                          fa: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">
                  نمایش: {formatPrice(config.subscriptionPricing.studioAnnual, "fa")}
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">قیمت سالانه (دلار)</span>
                <input
                  type="number"
                  value={config.subscriptionPricing.studioAnnual.en}
                  onChange={(e) =>
                    updateConfig({
                      subscriptionPricing: {
                        ...config.subscriptionPricing,
                        studioAnnual: {
                          ...config.subscriptionPricing.studioAnnual,
                          en: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="block text-[11px] text-muted">${config.subscriptionPricing.studioAnnual.en} / yr</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3. ARTIST SPECIFIC SHARE & COMMISSION OVERRIDES TABLE          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "artists" && (
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="font-display text-base font-bold text-foreground">
                جدول بررسی و تنظیم سهم فروش اختصاصی طراحان
              </h2>
              <p className="text-xs text-foreground-secondary mt-0.5">
                می‌توانید برای هر هنرمند سهم اختصاصی تعیین کنید؛ در صورت خالی بودن، سهم پیش‌فرض ({faNum(config.defaultArtistSharePct)}٪) اعمال می‌شود.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={artistSearch}
                onChange={(e) => setArtistSearch(e.target.value)}
                placeholder="جستجوی نام هنرمند یا تخصص…"
                className="h-9 w-full rounded-xl border border-border bg-background ps-9 pe-3 text-xs focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-background-secondary/60 text-foreground-secondary border-b border-border">
                <tr>
                  <th className="p-3.5 text-start font-semibold">هنرمند طراح</th>
                  <th className="p-3.5 text-start font-semibold">تخصص / سبک</th>
                  <th className="p-3.5 text-center font-semibold">اشتراک</th>
                  <th className="p-3.5 text-center font-semibold">سهم هنرمند (% سهم)</th>
                  <th className="p-3.5 text-center font-semibold">کمیسیون پلتفرم</th>
                  <th className="p-3.5 text-center font-semibold">غرفه خدمات پتینه</th>
                  <th className="p-3.5 text-center font-semibold">اقدام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredArtists.map((artist) => {
                  const effectiveShare = artist.revenueSharePct ?? config.defaultArtistSharePct;
                  const platformComm = 100 - effectiveShare;
                  const isCustom = artist.revenueSharePct !== undefined && artist.revenueSharePct > 0;

                  return (
                    <tr key={artist.id} className="hover:bg-background-secondary/30 transition">
                      {/* Artist info */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-border">
                            <Image src={artist.avatar} alt={t(artist.name, "fa")} fill sizes="36px" className="object-cover" />
                          </span>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{t(artist.name, "fa")}</p>
                            <p className="text-[11px] text-muted">{t(artist.location, "fa")}</p>
                          </div>
                        </div>
                      </td>

                      {/* Profession */}
                      <td className="p-3.5 text-foreground-secondary">
                        {t(artist.profession, "fa")}
                      </td>

                      {/* Subscription */}
                      <td className="p-3.5 text-center">
                        <Badge tone={artist.subscription?.status === "active" ? "accent" : "neutral"}>
                          {artist.subscription?.badge ? t(artist.subscription.badge, "fa") : "عضویت پایه"}
                        </Badge>
                      </td>

                      {/* Artist Share Input */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={effectiveShare}
                            onChange={(e) => handleArtistShareChange(artist.id, Number(e.target.value))}
                            className="h-8 w-16 text-center rounded-lg border border-border bg-background text-xs font-bold text-success focus:border-accent focus:outline-none"
                          />
                          <span className="text-foreground-secondary">٪</span>
                          {isCustom && (
                            <span className="rounded-full bg-accent/15 px-1.5 py-0.2 text-[9px] font-bold text-accent">
                              اختصاصی
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Platform Commission */}
                      <td className="p-3.5 text-center font-bold text-accent tabular">
                        {faNum(platformComm)}٪
                      </td>

                      {/* Services count */}
                      <td className="p-3.5 text-center">
                        {(artist.services ?? []).length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-accent font-semibold text-[11px]">
                            <Paintbrush className="h-3 w-3" />
                            {faNum((artist.services ?? []).length)} خدمت
                          </span>
                        ) : (
                          <span className="text-muted text-[11px]">ندارد</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center">
                        {isCustom ? (
                          <button
                            type="button"
                            onClick={() => handleArtistShareChange(artist.id, config.defaultArtistSharePct)}
                            className="text-[11px] text-muted hover:text-foreground hover:underline"
                            title="بازنشانی به نرخ پیش‌فرض"
                          >
                            بازنشانی به پیش‌فرض
                          </button>
                        ) : (
                          <span className="text-muted text-[11px]">مطابق پیش‌فرض</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 4. COMPREHENSIVE PRICING HUB (PATTERNS, PRODUCTS & SERVICES)    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "pricing-hub" && (
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border p-5">
            <div>
              <h2 className="font-display text-base font-bold text-foreground">
                ویرایشگر جامع قیمت‌های فروشگاه، پترن‌ها و خدمات پتینه
              </h2>
              <p className="text-xs text-foreground-secondary mt-0.5">
                بررسی و تغییر سریع قیمت‌های تومان و دلار هر آیتم در یک جدول منسجم.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1 text-xs">
                {[
                  { id: "all" as const, label: "همه" },
                  { id: "patterns" as const, label: "پترن‌ها" },
                  { id: "products" as const, label: "محصولات" },
                  { id: "services" as const, label: "خدمات پتینه" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCatalogType(f.id)}
                    className={`px-3 py-1 rounded-lg transition ${
                      catalogType === f.id ? "bg-accent text-white font-semibold" : "text-foreground-secondary hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="جستجوی عنوان یا هنرمند…"
                  className="h-9 w-full rounded-xl border border-border bg-background ps-9 pe-3 text-xs focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-background-secondary/60 text-foreground-secondary sticky top-0 z-10 border-b border-border backdrop-blur-sm">
                <tr>
                  <th className="p-3.5 text-start font-semibold">عنوان آیتم</th>
                  <th className="p-3.5 text-start font-semibold">نوع / دسته‌بندی</th>
                  <th className="p-3.5 text-start font-semibold">هنرمند / طراح</th>
                  <th className="p-3.5 text-center font-semibold">قیمت تومان</th>
                  <th className="p-3.5 text-center font-semibold">قیمت دلار</th>
                  <th className="p-3.5 text-center font-semibold">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {catalogItems.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-background-secondary/30 transition">
                    {/* Item title & image */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-background-secondary">
                          <Image src={item.image} alt={item.title} fill sizes="40px" className="object-cover" />
                        </span>
                        <div>
                          <p className="font-semibold text-foreground text-xs leading-snug">{item.title}</p>
                          <span className="text-[10px] text-muted">{item.skuOrCat}</span>
                        </div>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.type === "pattern" ? "bg-purple-100 text-purple-800" :
                        item.type === "product" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {item.type === "pattern" ? "پترن دیجیتال" :
                         item.type === "product" ? "محصول فیزیکی" : "خدمت پتینه/هنری"}
                      </span>
                    </td>

                    {/* Artist */}
                    <td className="p-3.5 text-foreground-secondary">
                      {item.artistName}
                    </td>

                    {/* Toman Price Editor */}
                    <td className="p-3.5 text-center">
                      <input
                        type="number"
                        step="10000"
                        value={item.price.fa}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (item.type === "pattern") handlePatternPriceChange(item.id, val);
                          else if (item.type === "product") handleProductPriceChange(item.id, val);
                          else if (item.type === "service" && item.artistId) handleServicePriceChange(item.artistId, item.id, val);
                        }}
                        className="h-8 w-28 text-center rounded-lg border border-border bg-background text-xs font-bold text-accent focus:border-accent focus:outline-none"
                      />
                    </td>

                    {/* USD Price Editor */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <span>$</span>
                        <input
                          type="number"
                          step="1"
                          value={item.price.en}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (item.type === "pattern") handlePatternPriceChange(item.id, item.price.fa, val);
                            else if (item.type === "product") handleProductPriceChange(item.id, item.price.fa, val);
                            else if (item.type === "service" && item.artistId) handleServicePriceChange(item.artistId, item.id, item.price.fa, val);
                          }}
                          className="h-8 w-16 text-center rounded-lg border border-border bg-background text-xs font-bold focus:border-accent focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      <span className="text-[11px] text-success font-medium flex items-center justify-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        فعال
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 5. PAYOUTS, THRESHOLDS & SHIPPING RULES                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "rules" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Payout Limits */}
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft space-y-4">
            <div>
              <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase">
                <Wallet className="h-4 w-4" />
                <span>تسویه حساب طراحان</span>
              </div>
              <h3 className="mt-1 font-display text-base font-bold text-foreground">
                حداقل موجودی مجاز برای درخواست تسویه
              </h3>
              <p className="mt-1 text-xs text-foreground-secondary">
                طراحان تنها در صورتی که موجودی کیف پول آن‌ها به این حد نصاب برسد می‌توانند درخواست واریز وجه ثبت کنند.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">حداقل تسویه (تومان)</label>
                <input
                  type="number"
                  step="50000"
                  value={config.minPayoutFa}
                  onChange={(e) => updateConfig({ minPayoutFa: Number(e.target.value) })}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  {faNum(config.minPayoutFa.toLocaleString("fa-IR"))} تومان
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">حداقل تسویه (دلار)</label>
                <input
                  type="number"
                  value={config.minPayoutEn}
                  onChange={(e) => updateConfig({ minPayoutEn: Number(e.target.value) })}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="text-[11px] text-muted mt-1 block">${config.minPayoutEn} USD</span>
              </div>
            </div>
          </div>

          {/* Shipping & Order Rules */}
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft space-y-4">
            <div>
              <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase">
                <ShoppingBag className="h-4 w-4" />
                <span>قوانین ارسال فروشگاه</span>
              </div>
              <h3 className="mt-1 font-display text-base font-bold text-foreground">
                سقف ارسال رایگان سفارش‌های فیزیکی
              </h3>
              <p className="mt-1 text-xs text-foreground-secondary">
                این آستانه فعلاً فقط در تنظیمات ذخیره می‌شود؛ محاسبهٔ هزینهٔ ارسال در checkout هنوز پیاده‌سازی نشده است.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">حداقل مبلغ سفارش برای ارسال رایگان (تومان)</label>
                <input
                  type="number"
                  step="100000"
                  value={config.freeShippingThresholdFa}
                  onChange={(e) => updateConfig({ freeShippingThresholdFa: Number(e.target.value) })}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold focus:border-accent focus:outline-none"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  {faNum(config.freeShippingThresholdFa.toLocaleString("fa-IR"))} تومان
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
