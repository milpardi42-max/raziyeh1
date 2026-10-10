import Image from "next/image";
import { ArrowDown, ArrowUpRight, UserRound } from "lucide-react";
import { PortfolioHeroVideo } from "./PortfolioHeroVideo";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { Locale, Localized } from "@/lib/i18n/types";
import type { PortfolioHeroSettings } from "@/lib/types";
import { portfolioHero as defaultSettings } from "@/lib/data/seed";
import { href, t } from "@/lib/utils";

interface Props {
  locale: Locale;
  background: string;
  video: { src: string; poster: string };
  instructor: { name: Localized; profession: Localized; avatar?: string };
  /** تنظیمات ظاهری از CMS — اگر ارسال نشود مقادیر پیش‌فرض استفاده می‌شود */
  settings?: PortfolioHeroSettings;
}

/** ── کلاس‌های پویای کارت مدرس بر اساس استایل انتخاب‌شده ── */
function cardClassName(style: PortfolioHeroSettings["instructorCardStyle"]): string {
  if (style === "glass")
    return "border border-white/20 bg-white/15 shadow-xl backdrop-blur-md hover:bg-white/20";
  if (style === "solid")
    return "border border-white/25 bg-[#f3eee5] text-[#202923] hover:bg-white shadow-xl";
  // invisible
  return "border border-transparent bg-transparent hover:bg-white/10";
}

/** Exclusive to the studio /portfolio page. Never used in an artist's portfolio. */
export function PortfolioHero({
  locale,
  background,
  video,
  instructor,
  settings,
}: Props) {
  const fa = locale === "fa";
  const cfg = { ...defaultSettings, ...settings };

  /* ── متن‌ها از CMS یا fallback ── */
  const eyebrow = fa ? cfg.eyebrowFa : cfg.eyebrowEn;
  const titleLine1 = fa ? cfg.titleLine1Fa : cfg.titleLine1En;
  const titleLine2 = fa ? cfg.titleLine2Fa : cfg.titleLine2En;
  const desc = fa ? cfg.descFa : cfg.descEn;

  /* ── کلاس‌های کارت مدرس ── */
  const avatarClass =
    cfg.instructorAvatarShape === "circle"
      ? "rounded-full"
      : "rounded-2xl";

  const avatarSize =
    cfg.instructorCardSize === "sm"
      ? "h-14 w-14 sm:h-16 sm:w-16"
      : "h-20 w-20 sm:h-24 sm:w-24";

  const titleTextSize =
    cfg.instructorCardSize === "sm"
      ? "text-base sm:text-lg"
      : "text-xl sm:text-2xl";

  const cardGap =
    cfg.instructorCardSize === "sm" ? "gap-3 sm:gap-4 p-3 sm:p-4" : "gap-4 sm:gap-5 p-4 sm:p-5";

  return (
    <section
      data-portfolio-hero
      className="relative isolate overflow-hidden bg-[#151c19] text-white"
    >
      <Image
        src={background}
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover object-center"
      />
      <div className="pointer-events-none absolute inset-0 bg-[#101a17]/45" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101a17] via-[#101a17]/15 to-[#101a17]/40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#101a17]/25 to-[#101a17]/60 rtl:bg-gradient-to-l" />

      <div className="container-x relative pb-6 pt-[calc(var(--announce-h,0px)+var(--header-h)+1.5rem)] md:pb-8 md:pt-[calc(var(--announce-h,0px)+var(--header-h)+2rem)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
          <Breadcrumb
            locale={locale}
            items={[
              { label: fa ? "خانه" : "Home", href: href(locale, "/") },
              { label: fa ? "پورتفولیو" : "Portfolio" },
            ]}
            className="text-white/60 [&_a]:text-white/60 [&_a:hover]:text-white [&_.text-foreground]:text-white [&_.text-border]:text-white/25"
          />
          <span
            className="text-[10px] tracking-[0.24em] text-[#d6bc8e]"
            dir="ltr"
          >
            ROSIE ATELIER / PORTFOLIO
          </span>
        </div>

        <div className="grid items-center gap-10 py-10 md:gap-12 md:py-14 lg:min-h-[640px] lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* ── ستون متن ── */}
          <div>
            <p className="flex items-center gap-3 text-xs font-medium text-[#d6bc8e]">
              <span className="h-px w-9 bg-[#d6bc8e]/70" />
              {eyebrow}
            </p>
            <h1 className="pf-hero-title mt-6 font-display text-[clamp(2.8rem,5.2vw,5.2rem)] leading-[1.3] tracking-tight whitespace-nowrap">
              <span>{titleLine1}</span>{" "}<span className="text-[#e4cba4]">{titleLine2}</span>
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-8 text-white/70 md:text-base md:leading-8">
              {desc}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#works"
                className="inline-flex min-h-12 items-center justify-center gap-4 rounded-full bg-[#e4cba4] px-6 text-sm font-medium text-[#17201b] transition-colors hover:bg-[#f0ddbd] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {fa ? "کشف آثار و پروژه‌ها" : "Explore the work"}
                <ArrowUpRight className="h-4 w-4 rtl-flip" aria-hidden />
              </a>
              <a
                href="#about"
                className="inline-flex min-h-12 items-center gap-3 rounded-full border border-white/25 px-6 text-sm text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {fa ? "آشنایی با مدرس" : "Meet the instructor"}
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/50">
              <span>{fa ? "طراحی پترن" : "Pattern design"}</span>
              <span className="h-1 w-1 rounded-full bg-[#d6bc8e]/60" aria-hidden />
              <span>{fa ? "پارچه و کاغذدیواری" : "Textile & wallpaper"}</span>
              <span className="h-1 w-1 rounded-full bg-[#d6bc8e]/60" aria-hidden />
              <span>{fa ? "هنر در فضا" : "Art in space"}</span>
            </div>
          </div>

          {/* ── ستون ویدئو + کارت مدرس ── */}
          <div className="mx-auto w-full max-w-[560px] lg:ms-auto lg:me-0">
            <PortfolioHeroVideo
              src={video.src}
              poster={video.poster}
              locale={locale}
              offsetLeft={cfg.videoOffsetLeft}
            />

            {cfg.instructorCardVisible && (
              <a
                href="#about"
                className={`group mt-4 flex items-center rounded-[20px] text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e4cba4] ${cardGap} ${cardClassName(cfg.instructorCardStyle)}`}
              >
                <span
                  className={`relative shrink-0 overflow-hidden border-2 border-white/30 bg-white/10 ${avatarSize} ${avatarClass}`}
                >
                  {instructor.avatar ? (
                    <Image
                      src={instructor.avatar}
                      alt={
                        fa
                          ? `تصویر پروفایل ${t(instructor.name, locale)}`
                          : `${t(instructor.name, locale)} profile image`
                      }
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <UserRound
                      className="mx-auto h-full w-7 text-white/60"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium uppercase tracking-widest text-[#e4cba4]/90">
                    {fa ? "مدرس و طراح مجموعه" : "The instructor & designer"}
                  </span>
                  <span className={`mt-0.5 block font-display leading-snug ${titleTextSize}`}>
                    {t(instructor.name, locale)}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-white/65">
                    {t(instructor.profession, locale)}
                  </span>
                </span>
                <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 transition-colors group-hover:bg-white/20 sm:flex">
                  <ArrowUpRight className="h-3.5 w-3.5 rtl-flip" aria-hidden />
                </span>
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5 text-[11px] text-white/45">
          <p>
            {fa
              ? "پورتفولیوی آتلیه رزی · هنر، آموزش و تجربهٔ طراحی"
              : "Rosie Atelier portfolio · Art, teaching & design practice"}
          </p>
          <a
            href="#works"
            className="inline-flex min-h-9 items-center gap-2 text-white/70 transition-colors hover:text-[#e4cba4]"
          >
            {fa ? "ادامهٔ روایت" : "Discover the collection"}
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
