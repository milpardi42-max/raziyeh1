"use client";

import Image from "next/image";
import Link from "next/link";
import { Lock, PlayCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/AppProviders";
import { cn, faNum, href, t } from "@/lib/utils";
import type { CourseVideoFile } from "@/lib/types";
import type { Locale } from "@/lib/i18n/types";

export interface AcademyVideoEntry {
  video: CourseVideoFile;
  courseSlug: string;
  courseTitle: CourseVideoFile["title"];
  lessonTitle?: CourseVideoFile["title"];
  /** Computed on the server from preview status and the viewer's entitlement. */
  canPlay?: boolean;
  /** Video of the featured course the hero already plays — not repeated here. */
  skip?: boolean;
}

/**
 * Every lesson video the admin uploaded, played for real.
 *
 * Free videos (the ones flagged as preview in the panel) stream inline; paid ones
 * stay behind the course page, which is where access is granted.
 */
export function VideoGrid({ entries, poster }: { entries: AcademyVideoEntry[]; poster?: string }) {
  const { locale } = useLocale();
  const fa = locale === "fa";
  const playable = entries.filter((entry) => entry.canPlay ?? entry.video.free === true);
  const [active, setActive] = useState<string | null>(playable[0]?.video.id ?? entries[0]?.video.id ?? null);
  const [failedVideoUrl, setFailedVideoUrl] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const current = entries.find((entry) => entry.video.id === active) ?? entries[0];
  const currentCanPlay = current ? (current.canPlay ?? current.video.free === true) : false;

  useEffect(() => {
    const selectFromHash = () => {
      try {
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (!hash.startsWith("course-videos-")) return;
        const id = hash.slice("course-videos-".length);
        if (entries.some((entry) => entry.video.id === id && (entry.canPlay ?? entry.video.free === true))) setActive(id);
      } catch { /* ignore malformed anchors */ }
    };
    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    return () => window.removeEventListener("hashchange", selectFromHash);
  }, [entries]);

  if (!entries.length) return null;

  const meta = (entry: AcademyVideoEntry) =>
    [entry.video.durationSec ? duration(entry.video.durationSec, locale) : null, sizeLabel(entry.video.sizeBytes, locale)]
      .filter(Boolean)
      .join(" · ");
  const displayTitle = (entry: AcademyVideoEntry) => entry.lessonTitle ?? entry.video.title;

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        {current && (
          <div className="overflow-hidden rounded-2xl border border-border bg-[#0c1018]">
            {!currentCanPlay ? (
              <div className="relative flex aspect-video flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
                <Lock className="h-8 w-8 text-white/70" />
                <p className="text-sm font-medium">{fa ? "برای تماشای این درس، ثبت‌نام و تأیید دسترسی لازم است." : "Enroll and receive access approval to watch this lesson."}</p>
                <Link href={href(locale, `/academy/${current.courseSlug}#enroll`)} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">
                  {fa ? "ثبت‌نام در دوره" : "Enroll in course"}
                </Link>
              </div>
            ) : failedVideoUrl === current.video.url ? (
              <div className="relative flex aspect-video items-center justify-center bg-black text-center text-white">
                {poster && <Image src={poster} alt="" fill sizes="(max-width:1024px) 100vw, 60vw" className="object-cover opacity-40" />}
                <div className="relative z-10 space-y-3 px-4">
                  <p role="alert" className="text-sm">{fa ? "ویدئو بارگذاری نشد؛ تصویر دوره نمایش داده می‌شود." : "The video could not load; showing the course image."}</p>
                  <button type="button" onClick={() => { setFailedVideoUrl(null); setRetry((value) => value + 1); }} className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/50 px-3 py-1.5 text-xs hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" />{fa ? "تلاش دوباره" : "Retry"}</button>
                </div>
              </div>
            ) : (
              <video
                key={`${current.video.url}-${retry}`}
                src={current.video.url}
                poster={poster}
                controls
                playsInline
                preload="metadata"
                onError={() => setFailedVideoUrl(current.video.url)}
                className="aspect-video w-full bg-black"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t(displayTitle(current), locale)}</p>
                <p className="text-caption text-white/55">
                  {t(current.courseTitle, locale)} · {meta(current)}
                </p>
              </div>
              <Link
                href={href(locale, `/academy/${current.courseSlug}`)}
                className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-caption hover:border-white/60"
              >
                {fa ? "صفحه دوره" : "Course page"}
              </Link>
            </div>
          </div>
        )}
      </div>
      <div className="lg:col-span-5">
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pe-1">
          {entries.map((entry) => {
            const unlocked = entry.canPlay ?? entry.video.free === true;
            const locked = !unlocked;
            const isActive = current?.video.id === entry.video.id;
            return (
              <li key={entry.video.id} id={`course-videos-${entry.video.id}`}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setActive(entry.video.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors",
                    isActive ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/60",
                    locked && "cursor-not-allowed opacity-70",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-accent">
                    {locked ? <Lock className="h-4 w-4" /> : <PlayCircle className="h-4.5 w-4.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{t(displayTitle(entry), locale)}</span>
                    <span className="block truncate text-caption text-foreground-secondary">
                      {t(entry.courseTitle, locale)}
                      {locked ? (fa ? " — نیازمند تأیید دسترسی" : " — access approval required") : ""}
                    </span>
                  </span>
                  {entry.video.durationSec ? (
                    <span className="shrink-0 text-caption text-muted tabular">{duration(entry.video.durationSec, locale)}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-caption text-muted">
          {fa
            ? `${faNum(playable.length)} درس قابل مشاهده از ${faNum(entries.length)} ویدیوی این دوره؛ دسترسی خصوصی فقط برای ثبت‌نام‌کنندگان تأییدشده فعال است.`
            : `${playable.length} playable lessons out of ${entries.length}; private videos are available only to approved enrollees.`}
        </p>
      </div>
    </div>
  );
}

function duration(seconds: number, locale: Locale): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return locale === "fa" ? "کمتر از ۱ دقیقه" : "< 1 min";
  return locale === "fa" ? `${faNum(minutes)} دقیقه` : `${minutes} min`;
}

function sizeLabel(bytes: number | undefined, locale: Locale): string {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  const value = mb >= 1024 ? mb / 1024 : mb;
  const unit = mb >= 1024 ? "GB" : "MB";
  return locale === "fa"
    ? `${faNum(Math.round(value * 10) / 10)} مگابایت`.replace("مگابایت", unit === "GB" ? "گیگابایت" : "مگابایت")
    : `${Math.round(value * 10) / 10} ${unit}`;
}
