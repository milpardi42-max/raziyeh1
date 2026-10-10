"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Film, Play, RotateCcw } from "lucide-react";
import type { Locale } from "@/lib/i18n/types";

/** Click-to-play: no autoplay, modal, sound surprises or continuous background download. */
export function PortfolioHeroVideo({
  src,
  poster,
  locale,
  offsetLeft = 0,
}: {
  src: string;
  poster: string;
  locale: Locale;
  /** Expands the preview toward the left on desktop, without shifting the instructor card. */
  offsetLeft?: number;
}) {
  const fa = locale === "fa";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState("");

  async function play() {
    const video = videoRef.current;
    if (!video || loading) return;
    setLoading(true);
    try {
      if (failed) video.load();
      setFailed(false);
      await video.play();
      setStarted(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-video-offset={Math.max(0, offsetLeft)}
      style={{ "--portfolio-video-offset": `${Math.max(0, offsetLeft)}px` } as CSSProperties}
      className="portfolio-hero-video-frame overflow-hidden rounded-[20px] border border-white/20 bg-[#171c1a] shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5 text-[11px] text-white/65">
        <span className="inline-flex items-center gap-2">
          <Film className="h-3.5 w-3.5 text-[#d6bc8e]" aria-hidden />
          {fa ? "پیش‌نمایش ویدئویی" : "The video preview"}
        </span>
        <span className="tracking-[0.2em]" dir="ltr">
          ROSIE / FILM
        </span>
      </div>
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls={started && !failed}
          playsInline
          preload="metadata"
          aria-label={
            fa ? "ویدئوی پیش‌نمایش آتلیه رزی" : "Rosie Atelier preview video"
          }
          className={`h-full w-full ${started ? "object-contain" : "object-cover"}`}
          onLoadedMetadata={() => {
            const seconds = videoRef.current?.duration;
            if (seconds && Number.isFinite(seconds))
              setDuration(
                `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`,
              );
          }}
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          onEnded={() => setStarted(false)}
        />
        {(!started || failed) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 px-5">
            <button
              type="button"
              onClick={play}
              disabled={loading}
              aria-label={
                failed
                  ? fa
                    ? "تلاش دوباره برای پخش"
                    : "Retry video"
                  : fa
                    ? "پخش پیش‌نمایش ویدئو"
                    : "Play video preview"
              }
              className="group flex h-[76px] w-[76px] items-center justify-center rounded-full border border-white/65 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white hover:text-[#171c1a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait"
            >
              {failed ? (
                <RotateCcw className="h-6 w-6" aria-hidden />
              ) : (
                <Play className="ms-1 h-7 w-7 fill-current" aria-hidden />
              )}
            </button>
            {loading && (
              <p role="status" className="mt-3 text-xs text-white">
                {fa ? "در حال بارگذاری…" : "Loading…"}
              </p>
            )}
            {failed && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-black/70 px-3 py-2 text-center text-xs text-white"
              >
                {fa
                  ? "ویدئو بارگذاری نشد؛ دوباره تلاش کنید."
                  : "The video could not load. Please try again."}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-white">
            {fa ? "مکثی در دنیای نقش و رنگ" : "A moment in pattern & colour"}
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            {fa ? "ویدئوی پیش‌نمایش آتلیه" : "An atelier video preview"}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[11px] tabular-nums text-[#e6d4b4]"
          dir="ltr"
        >
          {duration || "PLAY"}
        </span>
      </div>
    </div>
  );
}
