"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { useAuth, useLocale } from "@/components/providers/AppProviders";
import { href, t } from "@/lib/utils";
import type { ArtistServiceItem } from "@/lib/types";

export function ArtistInquiryForm({
  artistId,
  artistSlug,
  services,
  selectedService,
}: {
  artistId: string;
  artistSlug: string;
  services: Pick<ArtistServiceItem, "id" | "title">[];
  selectedService?: string;
}) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const fa = locale === "fa";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/artist/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artistId,
          artistSlug,
          ...Object.fromEntries(data.entries()),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(response.status === 429 ? "rate_limit" : "failed");
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message === "rate_limit"
          ? fa
            ? "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید."
            : "Too many requests. Please try again later."
          : fa
            ? "درخواست ثبت نشد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید."
            : "Your request could not be saved. Your details are still here; please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  if (success)
    return (
      <div
        role="status"
        className="rounded-2xl border border-border bg-surface p-10 text-center"
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-5 font-display text-2xl">
          {fa ? "درخواست شما ثبت شد" : "Your inquiry has been saved"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-foreground-secondary">
          {fa
            ? "جزئیات پروژه برای بررسی در اختیار هنرمند قرار گرفت. پاسخ‌گویی از طریق اطلاعات تماسی است که وارد کردید."
            : "Your project details are available to the artist for review. They can reply using the contact details you provided."}
        </p>
        <Link
          href={href(locale, `/artists/${artistSlug}`)}
          className="mt-6 inline-flex rounded-full border border-border px-5 py-3 text-sm"
        >
          {fa ? "بازگشت به پروفایل هنرمند" : "Back to artist profile"}
        </Link>
      </div>
    );
  const inputClass =
    "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";
  return (
    <form
      onSubmit={submit}
      aria-busy={submitting}
      className="rounded-2xl border border-border bg-surface p-6 sm:p-8"
    >
      <fieldset disabled={submitting} className="space-y-5 disabled:opacity-70">
        <legend className="mb-6 font-display text-xl">
          {fa ? "از پروژه‌تان بگویید" : "Tell us about your project"}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm">
            {fa ? "نام و نام خانوادگی *" : "Full name *"}
            <input
              name="clientName"
              autoComplete="name"
              required
              maxLength={120}
              defaultValue={user?.name ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            {fa ? "شماره تماس *" : "Phone number *"}
            <input
              name="clientPhone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={40}
              dir="ltr"
              className={inputClass}
            />
          </label>
        </div>
        <label className="block text-sm">
          {fa ? "ایمیل (اختیاری)" : "Email (optional)"}
          <input
            name="clientEmail"
            type="email"
            autoComplete="email"
            maxLength={254}
            defaultValue={user?.email ?? ""}
            dir="ltr"
            className={inputClass}
          />
        </label>
        {services.length > 0 && (
          <label className="block text-sm">
            {fa ? "خدمت مورد نظر" : "Service"}
            <select
              name="serviceId"
              defaultValue={selectedService ?? ""}
              className={inputClass}
            >
              <option value="">
                {fa ? "درخواست همکاری عمومی" : "General project inquiry"}
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.title, locale)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          {fa ? "عنوان یا نوع پروژه" : "Project title or type"}
          <input
            name="projectType"
            maxLength={200}
            placeholder={
              fa ? "مثلاً طراحی پترن پارچه" : "e.g. A textile pattern design"
            }
            className={inputClass}
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm">
            {fa ? "ابعاد یا محدودهٔ کار" : "Dimensions or scope"}
            <input
              name="scopeOrDimensions"
              maxLength={200}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            {fa ? "بودجهٔ تقریبی و واحد پول" : "Estimated budget & currency"}
            <input
              name="estimatedBudget"
              maxLength={200}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block text-sm">
          {fa ? "توضیحات پروژه *" : "Project details *"}
          <textarea
            name="message"
            required
            maxLength={5000}
            rows={6}
            placeholder={
              fa
                ? "سبک مورد نظر، زمان‌بندی و نیازهای پروژه را شرح دهید…"
                : "Describe your preferred style, timeline and project requirements…"
            }
            className={inputClass}
          />
        </label>
        <p className="text-xs leading-6 text-muted">
          {fa
            ? "اطلاعات تماس فقط برای بررسی و پیگیری این درخواست در اختیار هنرمند و مدیر سایت قرار می‌گیرد. ثبت درخواست به معنی تأیید قیمت یا سفارش نیست."
            : "Your contact details are shared with the artist and site administrator to handle this inquiry. Submitting does not confirm a price or place an order."}
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-foreground px-6 text-sm text-background hover:bg-accent disabled:cursor-wait sm:w-auto"
        >
          <Send className="h-4 w-4" />
          {submitting
            ? fa
              ? "در حال ثبت…"
              : "Submitting…"
            : fa
              ? "ارسال درخواست همکاری"
              : "Send project inquiry"}
        </button>
      </fieldset>
    </form>
  );
}
