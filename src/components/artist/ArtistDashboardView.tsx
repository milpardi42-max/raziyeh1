"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock,
  Crown,
  Edit2,
  Eye,
  FileStack,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Paintbrush,
  Phone,
  Plus,
  Save,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AssetStatusBadge, bytesLabel } from "@/components/artist/DashboardParts";
import { SignOutButton } from "@/components/profile/SignOutButton";
import { formatLabel } from "@/lib/marketplace/formats";
import { familyName } from "@/lib/data/families";
import type { ArtistDashboardData, DashboardWork } from "@/lib/artist/dashboard";
import type { Locale } from "@/lib/i18n/types";
import type { ArtistServiceItem, ArtistSubscription, ClientInquiry } from "@/lib/types";
import { faNum, formatNumber, formatPrice, href, t } from "@/lib/utils";

type ActiveTab = "overview" | "showcase" | "inquiries";

export function ArtistDashboardView({ locale, data }: { locale: Locale; data: ArtistDashboardData }) {
  const fa = locale === "fa";
  const { artist: initialArtist, totals, analytics, wallet } = data;

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [artist] = useState(initialArtist);
  const [services, setServices] = useState<ArtistServiceItem[]>(initialArtist?.services ?? []);
  const [inquiries, setInquiries] = useState<ClientInquiry[]>(initialArtist?.inquiries ?? []);
  const [subscription, setSubscription] = useState<ArtistSubscription | null>(initialArtist?.subscription ?? null);

  // New Service Modal state
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ArtistServiceItem | null>(null);
  const [serviceSaving, setServiceSaving] = useState(false);

  // Subscription Upgrade Modal state
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subSaving, setSubSaving] = useState(false);
  const [subSuccess, setSubSuccess] = useState(false);

  // Commission status toggle
  const [acceptingCommissions, setAcceptingCommissions] = useState(initialArtist?.acceptsCommissions ?? true);
  const [commissionNotice, setCommissionNotice] = useState(
    initialArtist?.commissionNotice?.fa || "آماده پذیرش سفارش‌های جدید پتینه، بافت دیوار و طراحی پترن‌های اختصاصی.",
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  const pending = totals.inReview > 0;
  const onboarding = [
    {
      done: Boolean(artist?.signupStudio || artist?.name),
      label: fa ? "پرونده‌ی استودیو ثبت شد" : "Studio file submitted",
      href: href(locale, "/artist/portfolio"),
    },
    { done: totals.works > 0, label: fa ? "اولین طرح ارسال شد" : "First work submitted", href: href(locale, "/artist/marketplace?tab=upload") },
    {
      done: services.length > 0,
      label: fa ? "ثبت اولین خدمت/پتینه در غرفه اختصاصی" : "First service listed in Pro showcase",
      href: "#",
      onClick: () => { setActiveTab("showcase"); setServiceModalOpen(true); },
    },
    {
      done: Boolean(subscription && subscription.status === "active"),
      label: fa ? "فعال‌سازی اشتراک Pro ویژه هنرمند" : "Artist Pro membership active",
      href: "#",
      onClick: () => { setActiveTab("showcase"); setSubModalOpen(true); },
    },
    {
      done: Boolean(wallet.profile),
      label: fa ? "اطلاعات تسویه ثبت شد" : "Payout details saved",
      href: href(locale, "/artist/marketplace?tab=wallet"),
    },
  ];
  const doneCount = onboarding.filter((row) => row.done).length;

  // Handle Save / Edit Service
  const handleSaveService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServiceSaving(true);
    const fd = new FormData(e.currentTarget);

    const titleFa = String(fd.get("title_fa") || "");
    const titleEn = String(fd.get("title_en") || titleFa);
    const category = String(fd.get("category") || "patina") as ArtistServiceItem["category"];
    const categoryLabelFa = String(fd.get("cat_label_fa") || "پتینه و بافت دیوار");
    const categoryLabelEn = String(fd.get("cat_label_en") || "Wall Patina");
    const descFa = String(fd.get("desc_fa") || "");
    const descEn = String(fd.get("desc_en") || descFa);
    const priceFa = Number(fd.get("price_fa") || 0);
    const priceEn = Number(fd.get("price_en") || Math.round(priceFa / 25000));
    const priceUnitFa = String(fd.get("price_unit_fa") || "به ازای هر متر مربع");
    const priceUnitEn = String(fd.get("price_unit_en") || "per sq.m");
    const deliveryFa = String(fd.get("delivery_fa") || "۷ تا ۱۰ روز کاری");
    const deliveryEn = String(fd.get("delivery_en") || "7-10 business days");
    const image = String(fd.get("image") || "/images/products/wallpaper-botanical.jpg");

    const payload: Partial<ArtistServiceItem> = {
      ...(editingService ? { id: editingService.id } : {}),
      title: { fa: titleFa, en: titleEn },
      category,
      categoryLabel: { fa: categoryLabelFa, en: categoryLabelEn },
      description: { fa: descFa, en: descEn },
      price: { fa: priceFa, en: priceEn },
      priceUnit: { fa: priceUnitFa, en: priceUnitEn },
      deliveryTime: { fa: deliveryFa, en: deliveryEn },
      image,
      featured: true,
      active: true,
    };

    try {
      if (editingService) {
        const res = await fetch("/api/artist/services", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ service: payload }),
        });
        const d = await res.json();
        if (d.ok) {
          setServices((prev) => prev.map((s) => (s.id === editingService.id ? { ...s, ...payload } as ArtistServiceItem : s)));
        }
      } else {
        const res = await fetch("/api/artist/services", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await res.json();
        if (d.ok && d.service) {
          setServices((prev) => [...prev, d.service]);
        }
      }
      setServiceModalOpen(false);
      setEditingService(null);
    } catch {
      alert(fa ? "خطا در ذخیره خدمت." : "Error saving service.");
    } finally {
      setServiceSaving(false);
    }
  };

  // Delete Service
  const handleDeleteService = async (serviceId: string) => {
    if (!confirm(fa ? "این خدمت از غرفه اختصاصی شما حذف شود؟" : "Delete this service?")) return;
    try {
      const res = await fetch(`/api/artist/services?id=${serviceId}`, { method: "DELETE" });
      const d = await res.json();
      if (d.ok) {
        setServices((prev) => prev.filter((s) => s.id !== serviceId));
      }
    } catch {
      alert(fa ? "خطا در حذف خدمت." : "Error deleting service.");
    }
  };

  // Update Subscription Plan
  const handleUpgradeSubscription = async (planId: "pro" | "studio") => {
    setSubSaving(true);
    try {
      const res = await fetch("/api/artist/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, periodMonths: 1 }),
      });
      const d = await res.json();
      if (d.ok && d.subscription) {
        setSubscription(d.subscription);
        setSubSuccess(true);
        setTimeout(() => {
          setSubSuccess(false);
          setSubModalOpen(false);
        }, 2000);
      }
    } catch {
      alert(fa ? "خطا در ارتقای اشتراک." : "Error upgrading subscription.");
    } finally {
      setSubSaving(false);
    }
  };

  // Update Commission / Settings
  const handleSaveShowcaseSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/artist/services", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          acceptsCommissions: acceptingCommissions,
          commissionNotice: { fa: commissionNotice, en: commissionNotice },
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setSettingsSavedMsg(true);
        setTimeout(() => setSettingsSavedMsg(false), 3000);
      }
    } catch {
      alert(fa ? "خطا در ذخیره تنظیمات." : "Error saving settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Update Inquiry Status
  const handleInquiryStatusChange = async (inquiryId: string, status: ClientInquiry["status"]) => {
    try {
      const res = await fetch("/api/artist/services", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inquiryId, inquiryStatus: status }),
      });
      const d = await res.json();
      if (d.ok) {
        setInquiries((prev) => prev.map((inq) => (inq.id === inquiryId ? { ...inq, status } : inq)));
      }
    } catch {
      // non-fatal
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start" dir={fa ? "rtl" : "ltr"}>

      {/* ══ Sidebar ══════════════════════════════════════════════════════ */}
      <aside className="w-full lg:w-60 xl:w-64 shrink-0 flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h,4rem)+1.5rem)]">

        {/* Artist card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-background-secondary border-2 border-border shadow-sm">
              {artist?.avatar ? (
                <Image src={artist.avatar} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-h3 text-muted">
                  {(t(artist?.name ?? { fa: "؟", en: "?" }, locale) || "؟").slice(0, 1)}
                </span>
              )}
            </span>
            <div>
              <p className="font-semibold text-sm leading-snug">{t(data.artistName, locale) || (fa ? "هنرمند طراح" : "Artist Designer")}</p>
              {artist?.profession && (
                <p className="mt-0.5 text-xs text-foreground-secondary">{t(artist.profession, locale)}</p>
              )}
              <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                <Badge tone={subscription?.status === "active" ? "accent" : "neutral"}>
                  <Crown className="me-1 h-3 w-3" />
                  {subscription?.status === "active"
                    ? t(subscription.badge ?? { fa: "هنرمند Pro", en: "Pro Artist" }, locale)
                    : (fa ? "عضویت پایه" : "Basic Member")}
                </Badge>
                <Badge tone="neutral">
                  {fa ? `${faNum(data.sharePct)}٪ سهم` : `${data.sharePct}% share`}
                </Badge>
              </div>

              {/* Commission & Share Breakdown */}
              <div className="mt-3.5 w-full rounded-xl border border-border/80 bg-background/60 p-2.5 text-[11px] shadow-xs">
                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>{fa ? "سهم فروش هنرمند:" : "Your sales share:"}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{faNum(data.sharePct)}٪</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-foreground-secondary border-t border-border/40 pt-1">
                  <span>{fa ? "کارمزد پلتفرم:" : "Platform fee:"}</span>
                  <span className="font-medium text-muted">{faNum(100 - data.sharePct)}٪</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tab Navigation */}
        <nav className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
            {fa ? "بخش‌های داشبورد" : "Dashboard Sections"}
          </p>
          <ul className="pb-2 space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium transition ${
                  activeTab === "overview"
                    ? "bg-accent/10 font-bold text-accent"
                    : "text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutGrid className="h-4 w-4" />
                  <span>{fa ? "نمای کلی و فروشگاه فایل" : "Overview & Assets"}</span>
                </span>
                <ChevronRight className={`h-3.5 w-3.5 opacity-40 ${fa ? "rotate-180" : ""}`} />
              </button>
            </li>

            {/* The VIP / Pro Showcase Tab (The user's requested tab) */}
            <li>
              <button
                type="button"
                onClick={() => setActiveTab("showcase")}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium transition ${
                  activeTab === "showcase"
                    ? "bg-accent/15 font-bold text-accent border-s-2 border-accent"
                    : "text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Paintbrush className="h-4 w-4 text-accent" />
                  <span className="font-semibold">{fa ? "تب اقتصادی و غرفه اختصاصی" : "Pro Showcase Hub"}</span>
                </span>
                <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[9px] font-bold text-accent">VIP</span>
              </button>
            </li>

            <li>
              <button
                type="button"
                onClick={() => setActiveTab("inquiries")}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium transition ${
                  activeTab === "inquiries"
                    ? "bg-accent/10 font-bold text-accent"
                    : "text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4" />
                  <span>{fa ? "استعلام‌ها و سفارش‌ها" : "Client Inquiries"}</span>
                </span>
                {inquiries.length > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {faNum(inquiries.length)}
                  </span>
                )}
              </button>
            </li>

            <li className="border-t border-border pt-1 mt-1">
              <Link
                href={href(locale, "/artist/marketplace?tab=upload")}
                className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-background bg-foreground mx-2 mb-1 rounded-xl transition hover:bg-primary"
              >
                <Plus className="h-4 w-4 shrink-0" />
                {fa ? "ارسال پترن تازه" : "Submit new work"}
              </Link>
            </li>

            {artist?.slug && (
              <li>
                <Link
                  href={href(locale, `/artists/${artist.slug}`)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-foreground-secondary transition hover:bg-background-secondary hover:text-foreground"
                >
                  <Eye className="h-4 w-4 text-muted" />
                  {fa ? "مشاهده پروفایل عمومی" : "View public profile"}
                </Link>
              </li>
            )}
            <li>
              <Link
                href={href(locale, "/account")}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-foreground-secondary transition hover:bg-background-secondary hover:text-foreground"
              >
                <User className="h-4 w-4 text-muted" />
                {fa ? "حساب من" : "My account"}
              </Link>
            </li>
            <li className="px-2 pt-1 pb-2 border-t border-border mt-1">
              <SignOutButton variant="ghost" size="md" className="w-full justify-start rounded-xl px-2 text-xs" />
            </li>
          </ul>
        </nav>

        {/* Setup progress */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <div className="px-4 pt-4 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
              {fa ? "راه‌اندازی استودیو و غرفه" : "Setup Progress"}
            </p>
            <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background-secondary">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.round((doneCount / onboarding.length) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-foreground-secondary mb-3">
              {fa ? `${faNum(doneCount)} از ${faNum(onboarding.length)} مرحله تکمیل شد` : `${doneCount} of ${onboarding.length} steps done`}
            </p>
            <ul className="space-y-1.5">
              {onboarding.map((row) => (
                <li key={row.label}>
                  <button
                    type="button"
                    onClick={row.onClick}
                    className={`flex w-full items-center gap-2 text-[11px] text-start transition rounded-lg px-1 py-0.5 ${
                      row.done ? "text-success" : "text-foreground-secondary hover:text-foreground"
                    }`}
                  >
                    {row.done
                      ? <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                      : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />}
                    <span className="leading-snug">{row.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* ══ Main content ═════════════════════════════════════════════════ */}
      <div className="min-w-0 flex-1 space-y-6 w-full">

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW & ASSETS                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <>
            {/* Top KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                icon={TrendingUp}
                label={fa ? "درآمد خالص ۳۰ روز گذشته" : "30-day net royalties"}
                value={formatPrice(analytics.royalties, locale)}
                delta={pctChange(analytics.royalties.fa, analytics.previous.revenue.fa)}
                hint={fa ? `از مجموع فروش ${formatPrice(analytics.revenue, locale)}` : `from ${formatPrice(analytics.revenue, locale)} gross`}
                fa={fa}
              />
              <Kpi
                icon={ShoppingBag}
                label={fa ? "تعداد فروش لایسنس" : "License orders"}
                value={faNum(analytics.sales)}
                delta={pctChange(analytics.sales, analytics.previous.sales)}
                hint={fa ? `${faNum(totals.live)} طرح فعال در فروشگاه` : `${totals.live} works live in store`}
                fa={fa}
              />
              <Kpi
                icon={Eye}
                label={fa ? "بازدید طرح‌ها" : "Work views"}
                value={formatNumber(analytics.views, locale)}
                delta={pctChange(analytics.views, analytics.previous.views)}
                hint={fa ? `نرخ تبدیل: ${faNum(analytics.conversionPct)}٪` : `Conversion: ${analytics.conversionPct}%`}
                fa={fa}
              />
              <Kpi
                icon={Wallet}
                label={fa ? "موجودی قابل تسویه" : "Available balance"}
                value={formatPrice(wallet.balance.available, locale)}
                delta={null}
                hint={wallet.profile ? (fa ? "اطلاعات حساب ثبت است" : "Payout account ready") : (fa ? "اطلاعات تسویه را ثبت کنید" : "Setup payout account")}
                fa={fa}
              />
            </div>

            {/* Quick banner linking to the Pro Showcase tab */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/10 via-primary/5 to-transparent p-5 shadow-soft">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-sm">
                  <Paintbrush className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">
                    {fa ? "غرفه اقتصادی اختصاصی و فروش خدمات پتینه" : "Exclusive Pro Showcase & Custom Services Hub"}
                  </h3>
                  <p className="text-xs text-foreground-secondary mt-0.5">
                    {fa
                      ? "علاوه بر فروش پترن‌ها، غرفه اختصاصی خود را در صفحه هنرمندان فعال کرده و کارهای پتینه و پروژه‌های سفارشی بفروشید."
                      : "Sell custom wall patina, bespoke wallpapers, and direct commissions directly to interior designers."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("showcase")}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{fa ? "مدیریت غرفه و اشتراک Pro" : "Manage Pro Showcase"}</span>
              </button>
            </div>

            {/* Works List */}
            <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <FileStack className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-h3">{fa ? "طرح‌ها و پترن‌های شما" : "Your Works"}</h2>
                  <Badge tone="neutral">{data.works.length}</Badge>
                </div>
                <Link
                  href={href(locale, "/artist/marketplace?tab=upload")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background transition hover:bg-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {fa ? "ارسال پترن تازه" : "Submit new work"}
                </Link>
              </div>

              {data.works.length === 0 ? (
                <div className="p-12 text-center">
                  <FileStack className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-2 text-sm text-foreground-secondary">{fa ? "هنوز طرحی ارسال نکرده‌اید." : "No works submitted yet."}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.works.map((work) => (
                    <WorkRow key={work.id} work={work} locale={locale} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 2: PRO SHOWCASE & CUSTOM SERVICES (The requested VIP Tab) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "showcase" && (
          <div className="space-y-6">

            {/* 1. Pro Membership & Subscription Status Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-surface via-accent/5 to-primary/10 p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent">
                    <Crown className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-accent">
                        {fa ? "تب اقتصادی مخصوص هنرمندان" : "Artist Pro Economic Hub"}
                      </span>
                      <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                        {subscription?.badge ? t(subscription.badge, locale) : (fa ? "اشتراک فعال" : "Active Plan")}
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold text-foreground">
                      {subscription?.planName ? t(subscription.planName, locale) : (fa ? "عضویت حرفه‌ای هنرمند (Artist Pro)" : "Artist Pro Membership")}
                    </h2>
                    <p className="mt-1 text-xs text-foreground-secondary max-w-xl leading-relaxed">
                      {fa
                        ? "با این اشتراک، غرفه اختصاصی شما در صفحه هنرمندان فعال است و می‌توانید علاوه بر پترن‌ها، خدمات پتینه، نقاشی دیواری و کارهای دست‌ساز را مستقیماً به معماران و مشتریان بفروشید."
                        : "Your dedicated storefront on the Artists Hub is live. Sell wall patina, murals, and bespoke craft directly with zero project commission."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setSubModalOpen(true)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-xs font-bold text-white shadow-medium transition hover:bg-accent/90"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{fa ? "ارتقا یا تمدید پلن اشتراک" : "Upgrade / Renew Plan"}</span>
                  </button>

                  {artist?.slug && (
                    <Link
                      href={href(locale, `/artists/${artist.slug}`)}
                      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface px-4 text-xs font-semibold text-foreground transition hover:border-foreground"
                    >
                      <Eye className="h-4 w-4" />
                      <span>{fa ? "مشاهده زنده غرفه" : "View Live Showcase"}</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Benefits Strip */}
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4 text-xs text-foreground-secondary">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <span>{fa ? "غرفه در صفحه هنرمندان" : "Showcase on Artists page"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <span>{fa ? "فروش پتینه و خدمات اختصاصی" : "Patina & Custom Services"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <span>{fa ? "دریافت استعلام مستقیم" : "Direct Client Inquiries"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <span>{fa ? "کارمزد صفر روی پروژه‌ها" : "0% Contract Commission"}</span>
                </div>
              </div>
            </div>

            {/* 2. Custom Services Manager (Patina, Murals, Canvas Art, etc.) */}
            <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Paintbrush className="h-4 w-4 text-accent" />
                    <h3 className="font-display text-base font-bold text-foreground">
                      {fa ? "خدمات و آثار قابل سفارش (پتینه، نقاشی و پروژه‌های اختصاصی)" : "Bespoke Offerings & Services"}
                    </h3>
                    <Badge tone="accent">{services.length}</Badge>
                  </div>
                  <p className="text-xs text-foreground-secondary mt-0.5">
                    {fa
                      ? "در این بخش می‌توانید هر نوع خدمت مانند پتینه‌کاری، بافت دیوار، تابلوی سفارشی یا طراحی پترن را تعریف و قیمت‌گذاری کنید."
                      : "List your custom craft offerings such as wall patina, microcement, custom murals, and bespoke patterns."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => { setEditingService(null); setServiceModalOpen(true); }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background transition hover:bg-primary self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{fa ? "افزودن خدمت یا اثر تازه" : "Add New Service"}</span>
                </button>
              </div>

              {services.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Paintbrush className="mx-auto h-10 w-10 text-muted" />
                  <p className="font-semibold text-sm text-foreground">{fa ? "هنوز خدمتی در غرفه اختصاصی خود ثبت نکرده‌اید." : "No custom services listed yet."}</p>
                  <p className="text-xs text-foreground-secondary max-w-md mx-auto">
                    {fa
                      ? "با افزودن خدمات مثل پتینه، نقاشی دیواری و پترن‌های سفارشی، مشتریان می‌توانند مستقیماً از صفحه هنرمندان استعلام قیمت ثبت کنند."
                      : "Add your custom wall patina or bespoke designs so clients can request quotes directly."}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setEditingService(null); setServiceModalOpen(true); }}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-white shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{fa ? "ثبت اولین خدمت در غرفه" : "List Your First Service"}</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {services.map((service) => (
                    <div key={service.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 hover:bg-background-secondary/40 transition">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-background-secondary">
                          <Image src={service.image} alt={t(service.title, locale)} fill sizes="80px" className="object-cover" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-display text-sm font-bold text-foreground">{t(service.title, locale)}</h4>
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              {t(service.categoryLabel ?? { fa: "خدمت اختصاصی", en: "Service" }, locale)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-foreground-secondary">{t(service.description, locale)}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground-secondary">
                            <span className="font-semibold text-foreground tabular">{formatPrice(service.price, locale)} {service.priceUnit ? `(${t(service.priceUnit, locale)})` : ""}</span>
                            {service.deliveryTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted" />
                                {t(service.deliveryTime, locale)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => { setEditingService(service); setServiceModalOpen(true); }}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-foreground"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>{fa ? "ویرایش" : "Edit"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteService(service.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-error transition hover:bg-error/10 hover:border-error"
                          title={fa ? "حذف خدمت" : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Showcase Visibility & Commission Settings */}
            <section className="rounded-3xl border border-border bg-surface p-6 shadow-soft space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    {fa ? "تنظیمات غرفه عمومی در صفحه هنرمندان" : "Showcase Public Settings"}
                  </h3>
                  <p className="text-xs text-foreground-secondary mt-0.5">
                    {fa ? "وضعیت آمادگی پذیرش سفارش‌های پتینه و متن اطلاعیه برای مشتریان." : "Accepting commissions status and public notice."}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptingCommissions}
                    onChange={(e) => setAcceptingCommissions(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {fa ? "متن اطلاعیه سفارش اختصاصی (نمایش در بالای غرفه)" : "Commission Notice"}
                </label>
                <textarea
                  value={commissionNotice}
                  onChange={(e) => setCommissionNotice(e.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-border bg-background p-3 text-xs focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {settingsSavedMsg ? (
                  <span className="text-xs font-medium text-success flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    {fa ? "تنظیمات با موفقیت ذخیره شد." : "Settings saved."}
                  </span>
                ) : <span />}

                <button
                  type="button"
                  onClick={handleSaveShowcaseSettings}
                  disabled={savingSettings}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-xs font-semibold text-background transition hover:bg-primary"
                >
                  {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{fa ? "ذخیره تنظیمات غرفه" : "Save Showcase Settings"}</span>
                </button>
              </div>
            </section>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 3: CLIENT INQUIRIES & COMMISSION LEADS                     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "inquiries" && (
          <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                <h3 className="font-display text-base font-bold text-foreground">
                  {fa ? "صندوق استعلام‌ها و سفارش‌های مستقیم مشتریان" : "Client Inquiries & Commission Leads"}
                </h3>
                <Badge tone="accent">{inquiries.length}</Badge>
              </div>
            </div>

            {inquiries.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <MessageSquare className="mx-auto h-8 w-8 text-muted" />
                <p className="font-medium text-sm text-foreground">{fa ? "هنوز استعلامی دریافت نشده است." : "No inquiries yet."}</p>
                <p className="text-xs text-foreground-secondary">{fa ? "استعلام‌های مشتریان از صفحه هنرمندان و غرفه شما در این بخش نمایش داده می‌شوند." : "Client quote requests from the Artists Hub will appear here."}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="p-5 space-y-3 hover:bg-background-secondary/30 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-foreground">{inq.clientName}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            inq.status === "pending" ? "bg-amber-100 text-amber-800" :
                            inq.status === "in_discussion" ? "bg-blue-100 text-blue-800" :
                            inq.status === "accepted" ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-800"
                          }`}>
                            {inq.status === "pending" ? (fa ? "در انتظار پاسخ" : "Pending") :
                             inq.status === "in_discussion" ? (fa ? "در حال هماهنگی" : "In Discussion") :
                             inq.status === "accepted" ? (fa ? "توافق شده / در حال اجرا" : "Accepted") : (fa ? "تکمیل شده" : "Completed")}
                          </span>
                        </div>
                        <p className="text-xs text-accent font-medium mt-0.5">{inq.projectType} {inq.scopeOrDimensions ? `(${inq.scopeOrDimensions})` : ""}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={inq.status}
                          onChange={(e) => handleInquiryStatusChange(inq.id, e.target.value as ClientInquiry["status"])}
                          className="h-8 rounded-lg border border-border bg-background px-2 text-xs focus:border-accent focus:outline-none"
                        >
                          <option value="pending">{fa ? "در انتظار پاسخ" : "Pending"}</option>
                          <option value="in_discussion">{fa ? "در حال هماهنگی" : "In Discussion"}</option>
                          <option value="accepted">{fa ? "توافق شده" : "Accepted"}</option>
                          <option value="completed">{fa ? "تکمیل شده" : "Completed"}</option>
                        </select>

                        {inq.clientPhone && (
                          <a
                            href={`https://wa.me/${inq.clientPhone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            <Send className="h-3 w-3" />
                            <span>{fa ? "واتساپ" : "WhatsApp"}</span>
                          </a>
                        )}
                        {inq.clientPhone && (
                          <a
                            href={`tel:${inq.clientPhone}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition hover:border-foreground"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{inq.clientPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-3 text-xs text-foreground-secondary leading-relaxed">
                      <p>{inq.message}</p>
                      {inq.estimatedBudget && (
                        <p className="mt-1.5 font-semibold text-foreground">
                          {fa ? `بودجه پیشنهادی کارفرما: ${inq.estimatedBudget}` : `Budget: ${inq.estimatedBudget}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT CUSTOM SERVICE (Patina, Murals, Canvas Art)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm anim-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => { setServiceModalOpen(false); setEditingService(null); }}
              className="absolute top-4 inset-inline-end-4 flex h-8 w-8 items-center justify-center rounded-full bg-background-secondary text-foreground hover:bg-border"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Paintbrush className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  {editingService ? (fa ? "ویرایش خدمت در غرفه اختصاصی" : "Edit Service") : (fa ? "افزودن خدمت یا اثر تازه به غرفه اختصاصی" : "Add New Offering")}
                </h3>
                <p className="text-xs text-foreground-secondary">{fa ? "پتینه‌کاری، بافت دیوار، نقاشی سفارشی یا طراحی پترن" : "Patina, wall finish, custom art or bespoke design"}</p>
              </div>
            </div>

            <form onSubmit={handleSaveService} className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "عنوان خدمت (فارسی)" : "Title (Fa)"}</label>
                  <input
                    type="text"
                    name="title_fa"
                    required
                    defaultValue={editingService?.title.fa || ""}
                    placeholder={fa ? "مثلاً: اجرای پتینه ایتالیایی و ورق طلا" : "e.g. Italian Gold Leaf Patina"}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "عنوان (انگلیسی)" : "Title (En)"}</label>
                  <input
                    type="text"
                    name="title_en"
                    dir="ltr"
                    defaultValue={editingService?.title.en || ""}
                    placeholder="e.g. Italian Wall Patina"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "دسته‌بندی تخصصی" : "Category"}</label>
                  <select
                    name="category"
                    defaultValue={editingService?.category || "patina"}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  >
                    <option value="patina">{fa ? "پتینه و بافت‌های دکوراتیو دیوار" : "Wall Patina & Finishes"}</option>
                    <option value="custom_pattern">{fa ? "طراحی پترن و پترن اختصاصی پروژه" : "Custom Pattern Design"}</option>
                    <option value="canvas_art">{fa ? "تابلوی نقاشی بوم و نقاشی دیواری" : "Canvas Art & Wall Murals"}</option>
                    <option value="interior_consulting">{fa ? "مشاوره کانسپت هنری و پالت رنگ" : "Art Direction & Color Palette"}</option>
                    <option value="sculpture_craft">{fa ? "آثار دست‌ساز و گچ‌بری برجسته" : "Handcrafted Sculptural Decor"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "برچسب نمایشی دسته‌بندی" : "Category Badge Label"}</label>
                  <input
                    type="text"
                    name="cat_label_fa"
                    defaultValue={editingService?.categoryLabel?.fa || "پتینه و بافت دیوار"}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "قیمت پایه (تومان)" : "Base Price (Toman)"}</label>
                  <input
                    type="number"
                    name="price_fa"
                    required
                    defaultValue={editingService?.price.fa || 450000}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "واحد قیمت" : "Price Unit"}</label>
                  <input
                    type="text"
                    name="price_unit_fa"
                    defaultValue={editingService?.priceUnit?.fa || "به ازای هر متر مربع"}
                    placeholder={fa ? "مثلاً: به ازای هر متر مربع یا پروژه‌ای" : "per sq.m or per project"}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "مدت زمان تقریبی اجرا/تحویل" : "Turnaround Time"}</label>
                  <input
                    type="text"
                    name="delivery_fa"
                    defaultValue={editingService?.deliveryTime?.fa || "۷ تا ۱۰ روز کاری"}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fa ? "تصویر نمونه‌کار" : "Cover Image"}</label>
                  <select
                    name="image"
                    defaultValue={editingService?.image || "/images/products/wallpaper-botanical.jpg"}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-accent focus:outline-none"
                  >
                    <option value="/images/products/wallpaper-botanical.jpg">{fa ? "نمونه پتینه گیاهی و سبز" : "Botanical Green"}</option>
                    <option value="/images/products/wallpaper-damask.jpg">{fa ? "نمونه پتینه لوکس و ورق طلا" : "Luxury Damask Gold"}</option>
                    <option value="/images/portfolios/pf-office.jpg">{fa ? "نمونه تکسچر میکروسمنت مدرن" : "Modern Microcement"}</option>
                    <option value="/images/portfolios/pf-kids.jpg">{fa ? "نمونه نقاشی دیواری اتاق کودک" : "Kids Nursery Mural"}</option>
                    <option value="/images/collections/s01.jpg">{fa ? "نمونه تابلوی نقاشی گواش بوم" : "Fine Art Canvas"}</option>
                    <option value="/images/collections/s02.jpg">{fa ? "نمونه طراحی پترن هندسی" : "Geometric Pattern"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{fa ? "توضیحات کامل درباره متریال، ماندگاری و جزئیات" : "Description"}</label>
                <textarea
                  name="desc_fa"
                  rows={3}
                  required
                  defaultValue={editingService?.description.fa || ""}
                  placeholder={fa ? "درباره نوع رنگ، ضدآب بودن، تکنیک اجرا و فضاهای پیشنهادی بنویسید…" : "Describe techniques, materials, and washable qualities…"}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:border-accent focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setServiceModalOpen(false); setEditingService(null); }}
                  className="inline-flex h-9 items-center rounded-xl border border-border px-4 text-xs font-medium text-foreground hover:bg-background-secondary"
                >
                  {fa ? "انصراف" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={serviceSaving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-5 text-xs font-bold text-white shadow-sm hover:bg-accent/90"
                >
                  {serviceSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{fa ? "ذخیره در غرفه" : "Save Service"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: UPGRADE / RENEW PRO SUBSCRIPTION                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {subModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm anim-fade-in">
          <div className="relative w-full max-w-xl rounded-3xl border border-border bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSubModalOpen(false)}
              className="absolute top-4 inset-inline-end-4 flex h-8 w-8 items-center justify-center rounded-full bg-background-secondary text-foreground hover:bg-border"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  {fa ? "ارتقا به عضویت حرفه‌ای هنرمند (Artist Pro)" : "Upgrade to Artist Pro"}
                </h3>
                <p className="text-xs text-foreground-secondary">{fa ? "فعال‌سازی غرفه اختصاصی در صفحه هنرمندان و فروش مستقیم پتینه و خدمات" : "Unlock dedicated storefront & sell patina/crafts"}</p>
              </div>
            </div>

            {subSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="font-display text-base font-bold text-foreground">{fa ? "اشتراک Pro شما با موفقیت فعال گردید!" : "Pro Membership Activated!"}</h4>
                <p className="text-xs text-foreground-secondary">{fa ? "غرفه اختصاصی و نشان تأیید VIP شما اکنون در صفحه هنرمندان فعال است." : "Your dedicated storefront and VIP badge are live."}</p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Pro Plan Card */}
                  <div className="relative flex flex-col justify-between rounded-2xl border-2 border-accent bg-accent/5 p-4">
                    <div className="absolute -top-2.5 inset-inline-end-3">
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                        {fa ? "پیشنهاد ما" : "Recommended"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-foreground">{fa ? "پلن حرفه‌ای Artist Pro" : "Artist Pro Plan"}</h4>
                      <p className="mt-1 font-display text-lg font-bold text-accent">{fa ? "۲۹۰٬۰۰۰ تومان / ماه" : "$9 / mo"}</p>
                      <ul className="mt-3 space-y-1.5 text-xs text-foreground-secondary">
                        <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{fa ? "غرفه اختصاصی در صفحه هنرمندان" : "Showcase on Artists Hub"}</li>
                        <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{fa ? "امکان فروش پتینه و خدمات" : "Sell custom patina & crafts"}</li>
                        <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{fa ? "دریافت استعلام مستقیم مشتریان" : "Direct client leads"}</li>
                        <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{fa ? "نشان تأیید VIP Pro" : "VIP Pro badge"}</li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      disabled={subSaving}
                      onClick={() => handleUpgradeSubscription("pro")}
                      className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-xs font-bold text-white shadow-sm hover:bg-accent/90"
                    >
                      {subSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      <span>{fa ? "فعال‌سازی پلن Pro" : "Activate Pro Plan"}</span>
                    </button>
                  </div>

                  {/* Studio VIP Plan Card */}
                  <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4">
                    <div>
                      <h4 className="font-display text-sm font-bold text-foreground">{fa ? "پلن استودیو VIP" : "Studio VIP Plan"}</h4>
                      <p className="mt-1 font-display text-lg font-bold text-foreground">{fa ? "۶۹۰٬۰۰۰ تومان / ماه" : "$24 / mo"}</p>
                      <ul className="mt-3 space-y-1.5 text-xs text-foreground-secondary">
                        <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{fa ? "تمام امکانات پلن Pro" : "All Pro features"}</li>
                        <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{fa ? "رتبه اول در لیست هنرمندان" : "Top ranking on directory"}</li>
                        <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{fa ? "معرفی به پروژه‌های بزرگ هتل" : "Hospitality project dispatch"}</li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      disabled={subSaving}
                      onClick={() => handleUpgradeSubscription("studio")}
                      className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:border-foreground"
                    >
                      <span>{fa ? "فعال‌سازی پلن استودیو" : "Activate Studio Plan"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Kpi({
  icon: Icon,
  label,
  value,
  delta,
  hint,
  fa,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta: number | null;
  hint: string;
  fa: boolean;
}) {
  const up = delta !== null && delta >= 0;
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <Icon className="h-4 w-4 text-accent" />
        {delta !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption ${
              up ? "bg-success/10 text-success" : "bg-error/10 text-error"
            }`}
            title={fa ? "نسبت به ۳۰ روز قبل" : "vs previous 30 days"}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {fa ? `${faNum(Math.abs(delta))}٪` : `${Math.abs(delta)}%`}
          </span>
        )}
      </div>
      <p className="mt-3 text-caption text-foreground-secondary">{label}</p>
      <p className="mt-1 font-display text-h3">{value}</p>
      <p className="mt-1 text-caption text-muted">{hint}</p>
    </div>
  );
}

function WorkRow({ work, locale }: { work: DashboardWork; locale: Locale }) {
  const fa = locale === "fa";
  const price = work.priceFrom;

  return (
    <li className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
      <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-background-secondary">
        {work.preview ? (
          <Image src={`/api/marketplace/media?key=${encodeURIComponent(work.preview)}`} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted">
            <FileStack className="h-5 w-5" />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm text-foreground">{t(work.title, locale)}</p>
          <AssetStatusBadge status={work.status} fa={fa} />
          {work.filesUpdatedAt && (
            <Badge tone="warning">{fa ? "فایل تازه — بازبینی دوباره" : "New files — re-review"}</Badge>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-foreground-secondary">
          {work.familyId && <span>{familyName(work.familyId, locale)}</span>}
          <span className="inline-flex items-center gap-1.5">
            {work.colourways.map((colourway) => (
              <span
                key={colourway.id}
                title={t(colourway.name, locale)}
                className="inline-block h-3.5 w-3.5 rounded-full border border-border"
                style={{ background: colourway.hex }}
              />
            ))}
            <span>{fa ? `${faNum(work.colourways.length)} رنگ` : `${work.colourways.length} colours`}</span>
          </span>
          <span dir="ltr" className="inline-flex flex-wrap gap-1">
            {work.formats.map((id) => (
              <span key={id} className="rounded border border-border px-1.5 py-0.5 text-[10px]">
                {formatLabel(id, locale)}
              </span>
            ))}
          </span>
          <span>{bytesLabel(work.bytes, locale)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <div className="text-center">
          <p className="text-caption text-muted">{fa ? "بازدید" : "Views"}</p>
          <p className="font-medium">{faNum(work.views)}</p>
        </div>
        <div className="text-center">
          <p className="text-caption text-muted">{fa ? "فروش" : "Sales"}</p>
          <p className="font-medium">{faNum(work.sales)}</p>
        </div>
        <div className="text-center">
          <p className="text-caption text-muted">{fa ? "از" : "From"}</p>
          <p className="font-medium">{price ? formatPrice(price, locale) : "—"}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href={href(locale, `/marketplace/${work.slug}`)}
            className="inline-flex h-8 items-center rounded-full border border-border px-3 text-caption transition hover:border-foreground"
          >
            {fa ? "مشاهده" : "View"}
          </Link>
        </div>
      </div>
    </li>
  );
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}
