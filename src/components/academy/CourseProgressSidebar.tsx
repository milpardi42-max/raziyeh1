"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Check, Lock, PlayCircle } from "lucide-react";
import { cn, faNum, formatDuration, t } from "@/lib/utils";
import type { LessonItem } from "@/lib/types";
import type { Locale } from "@/lib/i18n/types";

interface Props {
  courseId: string;
  lessons: LessonItem[];
  totalMin: number;
  locale: Locale;
  canAccess: boolean;
  videos: { id: string; lessonId?: string; canPlay: boolean }[];
  dict: { progress: string; lessons: string; minutes: string; hours: string; free: string };
}

const STORAGE_PREFIX = "ra-progress:";

export function CourseProgressSidebar({ courseId, lessons, totalMin, locale, canAccess, videos, dict }: Props) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const storageKey = `${STORAGE_PREFIX}${courseId}`;

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setCompleted(new Set(JSON.parse(raw) as string[]));
    } catch { /* silent */ }
  }, [storageKey]);

  const toggle = useCallback((id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* silent */ }
      return next;
    });
  }, [storageKey]);

  const pct = lessons.length > 0 ? Math.round((completed.size / lessons.length) * 100) : 0;
  const completedMin = lessons.filter((l) => completed.has(l.id)).reduce((s, l) => s + l.durationMin, 0);
  const freeLabel = locale === "fa" ? "رایگان" : "Free";

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-caption">
          <span className="font-medium text-foreground">{dict.progress}</span>
          <span className="tabular text-accent font-semibold">
            {locale === "fa" ? faNum(pct) : pct}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background-secondary">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-foreground-secondary tabular">
          {locale === "fa"
            ? `${faNum(completed.size)} از ${faNum(lessons.length)} درس — ${faNum(completedMin)} دقیقه`
            : `${completed.size} / ${lessons.length} lessons — ${completedMin} min`}
        </p>
      </div>

      {/* Lesson list */}
      <ol className="space-y-1">
        {lessons.map((lesson, i) => {
          const done = completed.has(lesson.id);
          const video = videos.find((entry) => entry.lessonId === lesson.id);
          const playable = video?.canPlay === true;
          const locked = Boolean(video && !playable && !lesson.free && !canAccess);
          const canMarkComplete = playable && !locked;
          return (
            <li key={lesson.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-2">
              <button
                type="button"
                disabled={!canMarkComplete}
                aria-pressed={done}
                onClick={() => toggle(lesson.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded px-1 py-1 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                  done ? "text-foreground" : "text-foreground-secondary hover:text-foreground",
                )}
              >
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular",
                  done ? "bg-accent text-white" : "bg-background-secondary text-muted",
                )}>
                  {done
                    ? <Check className="h-3.5 w-3.5" />
                    : playable
                      ? <PlayCircle className="h-3.5 w-3.5 text-accent" />
                      : locked
                        ? <Lock className="h-3.5 w-3.5" />
                        : <span>{locale === "fa" ? faNum(i + 1) : i + 1}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-snug">{t(lesson.title, locale)}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px]">
                    <span className="tabular">{formatDuration(lesson.durationMin, locale, { minutes: dict.minutes, hours: dict.hours })}</span>
                    {lesson.free && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">{freeLabel}</span>}
                  </span>
                </span>
              </button>
              {playable && video ? (
                <Link href={`#course-videos-${encodeURIComponent(video.id)}`} className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent hover:bg-accent/20">
                  {locale === "fa" ? "پخش" : "Watch"}
                </Link>
              ) : video && locked ? (
                <span className="shrink-0 text-[10px] text-muted">{locale === "fa" ? "قفل" : "Locked"}</span>
              ) : (
                <span className="shrink-0 text-[10px] text-muted">{locale === "fa" ? "ویدیو بارگذاری نشده" : "No video"}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Total duration */}
      <p className="border-t border-border pt-3 text-caption text-foreground-secondary tabular">
        {locale === "fa"
          ? `مجموع: ${faNum(Math.round(totalMin / 60))} ساعت ${faNum(totalMin % 60)} دقیقه`
          : `Total: ${Math.floor(totalMin / 60)}h ${totalMin % 60}m`}
      </p>
    </div>
  );
}
