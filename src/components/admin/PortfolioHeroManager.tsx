"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Circle,
  Square,
  Layers,
  Type,
  Video,
  User,
  Info,
} from "lucide-react";
import type { PortfolioHeroSettings } from "@/lib/types";

interface Props {
  settings: PortfolioHeroSettings;
  onChange: (s: PortfolioHeroSettings) => void;
}

/* ── ابزارهای کمکی ── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[#374151]">{label}</label>
      {hint && <p className="text-[11px] text-[#6b7280]">{hint}</p>}
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20"
    />
  );
}

function Textarea({
  value,
  onChange,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  dir?: "rtl" | "ltr";
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      dir={dir}
      className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20"
    />
  );
}

type SegmentOption<T> = { value: T; label: string; icon?: React.ReactNode };
function SegmentControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-white text-[#111827] shadow-sm"
              : "text-[#6b7280] hover:text-[#374151]"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-[#6366f1]" : "bg-[#d1d5db]"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </div>
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#f3f4f6] px-5 py-3.5">
        <span className="text-[#6366f1]">{icon}</span>
        <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

/* ── Preview mini ── */
function HeroPreviewBadge({ settings }: { settings: PortfolioHeroSettings }) {
  const cardClass =
    settings.instructorCardStyle === "invisible"
      ? "border-transparent bg-transparent"
      : settings.instructorCardStyle === "glass"
        ? "border-white/20 bg-white/15 backdrop-blur-md"
        : "border-white/25 bg-[#f3eee5]";

  const avatarClass =
    settings.instructorAvatarShape === "circle" ? "rounded-full" : "rounded-xl";

  const textScale = settings.instructorCardSize === "sm" ? "text-[8px]" : "text-[10px]";

  if (!settings.instructorCardVisible) {
    return (
      <div className="flex h-16 w-full items-center justify-center rounded-lg bg-[#1e2533] text-[10px] text-white/40">
        کارت مدرس پنهان است
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-[10px] border p-2 ${cardClass}`}
      style={{ background: settings.instructorCardStyle === "invisible" ? "transparent" : undefined }}
    >
      <div
        className={`h-8 w-8 shrink-0 overflow-hidden border border-white/30 bg-white/20 ${avatarClass}`}
        style={{ backgroundImage: "url('/images/education/e01.jpg')", backgroundSize: "cover" }}
      />
      <div className="min-w-0">
        <div className={`font-bold text-white ${textScale}`}>راضیه خیری‌پور</div>
        <div className={`text-white/60 ${textScale}`}>مدرس و میزبان آکادمی</div>
      </div>
    </div>
  );
}

/* ── مدیر اصلی ── */
export function PortfolioHeroManager({ settings, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<"content" | "instructor" | "video">("content");

  const set = <K extends keyof PortfolioHeroSettings>(k: K, v: PortfolioHeroSettings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="space-y-6">
      {/* ── سرصفحه ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#e5e7eb] bg-white px-6 py-5">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">هیرو صفحه پورتفولیو</h2>
          <p className="mt-0.5 text-sm text-[#6b7280]">
            تنظیمات ظاهری و محتوای بخش هیرو در صفحه{" "}
            <code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-xs">/portfolio</code>
          </p>
        </div>
        <a
          href="/fa/portfolio"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-medium text-[#374151] transition hover:bg-[#f9fafb]"
        >
          <Eye className="h-3.5 w-3.5" />
          پیش‌نمایش صفحه
        </a>
      </div>

      {/* ── تب‌ها ── */}
      <div className="flex gap-1 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-1">
        {(
          [
            { id: "content", label: "محتوای متنی", icon: <Type className="h-3.5 w-3.5" /> },
            { id: "instructor", label: "کارت مدرس", icon: <User className="h-3.5 w-3.5" /> },
            { id: "video", label: "کادر ویدئو", icon: <Video className="h-3.5 w-3.5" /> },
          ] as { id: "content" | "instructor" | "video"; label: string; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === t.id
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#6b7280] hover:text-[#374151]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* ── پنل چپ: فرم ── */}
        <div className="space-y-5">
          {/* ─ محتوا ─ */}
          {activeTab === "content" && (
            <>
              <SectionCard icon={<Type className="h-4 w-4" />} title="سردبیری (eyebrow)">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="فارسی" hint="خط کوچک بالای تیتر">
                    <Input value={settings.eyebrowFa} onChange={(v) => set("eyebrowFa", v)} dir="rtl" />
                  </Field>
                  <Field label="English">
                    <Input value={settings.eyebrowEn} onChange={(v) => set("eyebrowEn", v)} dir="ltr" />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={<Type className="h-4 w-4" />} title="تیتر اصلی — خط اول">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="فارسی">
                    <Input value={settings.titleLine1Fa} onChange={(v) => set("titleLine1Fa", v)} dir="rtl" />
                  </Field>
                  <Field label="English">
                    <Input value={settings.titleLine1En} onChange={(v) => set("titleLine1En", v)} dir="ltr" />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={<Type className="h-4 w-4" />} title="تیتر اصلی — خط دوم (طلایی)">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="فارسی">
                    <Input value={settings.titleLine2Fa} onChange={(v) => set("titleLine2Fa", v)} dir="rtl" />
                  </Field>
                  <Field label="English">
                    <Input value={settings.titleLine2En} onChange={(v) => set("titleLine2En", v)} dir="ltr" />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={<Type className="h-4 w-4" />} title="توضیحات (پاراگراف زیر تیتر)">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="فارسی">
                    <Textarea value={settings.descFa} onChange={(v) => set("descFa", v)} dir="rtl" />
                  </Field>
                  <Field label="English">
                    <Textarea value={settings.descEn} onChange={(v) => set("descEn", v)} dir="ltr" />
                  </Field>
                </div>
              </SectionCard>
            </>
          )}

          {/* ─ کارت مدرس ─ */}
          {activeTab === "instructor" && (
            <>
              <SectionCard icon={<User className="h-4 w-4" />} title="نمایش کارت">
                <Toggle
                  checked={settings.instructorCardVisible}
                  onChange={(v) => set("instructorCardVisible", v)}
                  label="نمایش کارت معرفی مدرس"
                />
              </SectionCard>

              {settings.instructorCardVisible && (
                <>
                  <SectionCard icon={<Layers className="h-4 w-4" />} title="استایل کادر">
                    <Field label="ظاهر کادر" hint="invisible: بدون کادر مرئی | glass: شیشه‌ای | solid: جامد روشن">
                      <SegmentControl
                        value={settings.instructorCardStyle}
                        onChange={(v) => set("instructorCardStyle", v)}
                        options={[
                          { value: "invisible", label: "نامرئی" },
                          { value: "glass", label: "شیشه‌ای" },
                          { value: "solid", label: "جامد" },
                        ]}
                      />
                    </Field>
                  </SectionCard>

                  <SectionCard icon={<Circle className="h-4 w-4" />} title="شکل تصویر مدرس">
                    <SegmentControl
                      value={settings.instructorAvatarShape}
                      onChange={(v) => set("instructorAvatarShape", v)}
                      options={[
                        { value: "circle", label: "دایره", icon: <Circle className="h-3.5 w-3.5" /> },
                        { value: "rounded", label: "مربع‌گوش", icon: <Square className="h-3.5 w-3.5" /> },
                      ]}
                    />
                  </SectionCard>

                  <SectionCard icon={<Type className="h-4 w-4" />} title="اندازه محتوا">
                    <SegmentControl
                      value={settings.instructorCardSize}
                      onChange={(v) => set("instructorCardSize", v)}
                      options={[
                        { value: "sm", label: "کوچک" },
                        { value: "md", label: "متوسط" },
                      ]}
                    />
                  </SectionCard>
                </>
              )}
            </>
          )}

          {/* ─ کادر ویدئو ─ */}
          {activeTab === "video" && (
            <SectionCard icon={<Video className="h-4 w-4" />} title="موقعیت کادر ویدئو">
              <Field
                label="کشش از سمت چپ (پیکسل)"
                hint="مقدار منفی به سمت چپ می‌کشد. مثلاً ۱۰۰ یعنی ۱۰۰px بیشتر از محدوده معمول."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={10}
                    value={settings.videoOffsetLeft}
                    onChange={(e) => set("videoOffsetLeft", Number(e.target.value))}
                    className="flex-1 accent-[#6366f1]"
                  />
                  <span className="w-14 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1.5 text-center text-sm tabular-nums text-[#111827]">
                    {settings.videoOffsetLeft}px
                  </span>
                </div>
              </Field>
              <div className="flex items-start gap-2 rounded-lg bg-[#eff6ff] px-3 py-2.5 text-xs text-[#1d4ed8]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                این تنظیم فقط در نمایشگرهای بزرگ (lg+) اعمال می‌شود.
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── پنل راست: preview ── */}
        <div className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h,56px)+1rem)] space-y-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9ca3af]">
              پیش‌نمایش کارت
            </p>
            <div className="overflow-hidden rounded-lg bg-[#1a2330] p-4">
              <HeroPreviewBadge settings={settings} />
            </div>
            <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white p-3 text-[11px] text-[#374151]">
              <p className="font-medium text-[#111827]">خلاصه تنظیمات</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <span className="text-[#9ca3af]">نمایش کارت</span>
                <span>{settings.instructorCardVisible ? "✓ فعال" : "✗ پنهان"}</span>
                <span className="text-[#9ca3af]">استایل</span>
                <span>
                  {settings.instructorCardStyle === "invisible"
                    ? "نامرئی"
                    : settings.instructorCardStyle === "glass"
                      ? "شیشه‌ای"
                      : "جامد"}
                </span>
                <span className="text-[#9ca3af]">شکل عکس</span>
                <span>{settings.instructorAvatarShape === "circle" ? "دایره" : "مربع‌گوش"}</span>
                <span className="text-[#9ca3af]">اندازه</span>
                <span>{settings.instructorCardSize === "sm" ? "کوچک" : "متوسط"}</span>
                <span className="text-[#9ca3af]">آفست ویدئو</span>
                <span>{settings.videoOffsetLeft}px</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
