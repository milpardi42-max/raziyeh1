import type { Metadata } from "next";
import type { Localized, Locale } from "@/lib/i18n/types";
import type { SeoMeta } from "@/lib/types";

export interface SeoRouteDefinition extends SeoMeta {
  label: string;
}

const l = (fa: string, en: string): Localized => ({ fa, en });

/** Public, stable routes whose metadata is managed by the main admin SEO tab. */
export const SEO_ROUTE_DEFAULTS: readonly SeoRouteDefinition[] = [
  { path: "/", label: "صفحهٔ اصلی", title: l("آتلیه رزی — پترن، کاغذدیواری، پارچه و دکور", "Rosie Atelier — Pattern, Wallpaper, Fabric & Décor"), description: l("پترن‌های اورجینال برای کاغذدیواری، طراحی پارچه، پرده و دکور — با طراحان مستقل.", "Original patterns for wallpaper, fabric design, curtains and décor — with independent designers.") },
  { path: "/about", label: "دربارهٔ ما", title: l("دربارهٔ آتلیه رزی", "About Rosie Atelier"), description: l("با آتلیه رزی، رویکرد ما به پترن، طراحی و فضا آشنا شوید.", "Discover Rosie Atelier, our approach to pattern, design and spaces.") },
  { path: "/academy", label: "آکادمی", title: l("آکادمی — آتلیه رزی", "Academy — Rosie Atelier"), description: l("آموزش طراحی پترن از مبانی تا کاغذدیواری و پارچه.", "Pattern design education from foundations to wallpaper and textile.") },
  { path: "/artists", label: "هنرمندان", title: l("طراحان آتلیه رزی", "Rosie Atelier Designers"), description: l("کشف طراحان آتلیه رزی؛ معرفی، نمونه‌کارها و صفحهٔ اختصاصی هر طراح.", "Meet the designers of Rosie Atelier. Explore their profiles, portfolios and creative practice.") },
  { path: "/collections", label: "مجموعه‌ها", title: l("مجموعه‌ها — آتلیه رزی", "Collections — Rosie Atelier"), description: l("مجموعه‌های منتخب پترن و محصولات آتلیه رزی.", "Curated collections of patterns and products from Rosie Atelier.") },
  { path: "/contact", label: "تماس با ما", title: l("تماس با آتلیه رزی", "Contact Rosie Atelier"), description: l("راه‌های ارتباط با آتلیه رزی برای پرسش‌ها و همکاری.", "Contact Rosie Atelier with questions, project enquiries or collaboration ideas.") },
  { path: "/creators/join", label: "پیوستن به هنرمندان", title: l("همکاری با آتلیه رزی", "Join Rosie Atelier as a Creator"), description: l("اطلاعات همکاری هنرمندان و طراحان با آتلیه رزی.", "Information for artists and designers interested in joining Rosie Atelier.") },
  { path: "/custom", label: "تولید سفارشی", title: l("تولید سفارشی — آتلیه رزی", "Custom Design — Rosie Atelier"), description: l("درخواست طراحی و تولید سفارشی برای پروژه‌ها و فضاهای شما.", "Request custom pattern design and production for your project or space.") },
  { path: "/faq", label: "پرسش‌های متداول", title: l("پرسش‌های متداول — آتلیه رزی", "Frequently Asked Questions — Rosie Atelier"), description: l("پاسخ پرسش‌های متداول دربارهٔ محصولات، سفارش و همکاری با آتلیه رزی.", "Answers to common questions about products, orders and working with Rosie Atelier.") },
  { path: "/marketplace", label: "فروشگاه فایل دیجیتال", title: l("فروشگاه فایل دیجیتال و لایسنس", "Digital Files & Licensing"), description: l("خرید آثار دیجیتال با لایسنس شفاف، دانلود امن و گواهی.", "Buy digital works with clear licensing, secure downloads and certificates.") },
  { path: "/marketplace/subscriptions", label: "اشتراک‌های دیجیتال", title: l("اشتراک‌های فروشگاه دیجیتال", "Digital Marketplace Subscriptions"), description: l("بررسی پلن‌های اشتراک و امکانات فروشگاه دیجیتال.", "Explore digital marketplace subscription plans and features.") },
  { path: "/patterns", label: "فهرست پترن‌ها", title: l("پترن‌ها — آتلیه رزی", "Patterns — Rosie Atelier"), description: l("کتابخانهٔ پترن‌های اورجینال با لایسنس تجاری برای سطح و فضا.", "A library of original patterns with commercial licenses for surface and space.") },
  { path: "/portfolio", label: "پورتفولیو", title: l("پورتفولیو — آتلیه رزی", "Portfolio — Rosie Atelier"), description: l("پروژه‌های اجراشده: کاغذدیواری، پرده و دکور در فضاهای واقعی.", "Realised projects: wallpaper, curtains and décor in real spaces.") },
  { path: "/projects", label: "پروژه‌ها", title: l("پروژه‌های آتلیه رزی", "Rosie Atelier Projects"), description: l("پروژه‌های طراحی و اجراشدهٔ آتلیه رزی.", "Selected design and installation projects by Rosie Atelier.") },
  { path: "/razieh", label: "دربارهٔ راضیه", title: l("راضیه — بنیان‌گذار آتلیه رزی", "Razieh — Founder of Rosie Atelier"), description: l("با بنیان‌گذار و مسیر خلاقهٔ آتلیه رزی آشنا شوید.", "Meet the founder and creative journey behind Rosie Atelier.") },
  { path: "/returns", label: "بازگشت و مرجوعی", title: l("بازگشت و مرجوعی — آتلیه رزی", "Returns — Rosie Atelier"), description: l("اطلاعات شرایط بازگشت و پیگیری سفارش‌های آتلیه رزی.", "Information about returns and order follow-up at Rosie Atelier.") },
  { path: "/shop", label: "فروشگاه", title: l("فروشگاه — کاغذدیواری، پارچه، پرده، دکور", "Shop — Wallpaper, Fabric, Curtains, Décor"), description: l("کاغذدیواری، طراحی پارچه، پرده و اشیاء دکور با پترن‌های آتلیه رزی.", "Wallpaper, fabric design, curtains and décor objects with Rosie Atelier patterns.") },
  { path: "/spaces", label: "فضاها", title: l("فضاها — آتلیه رزی", "Spaces — Rosie Atelier"), description: l("ایده‌ها و پترن‌ها را بر اساس فضای موردنظر کشف کنید.", "Explore ideas and patterns by room and space.") },
  { path: "/stories", label: "روایت‌ها", title: l("روایت‌ها — آتلیه رزی", "Stories — Rosie Atelier"), description: l("روایت هنرمندان، فرایند خلاقه و داستان پشت آثار.", "Stories from artists, creative processes and the ideas behind the work.") },
  { path: "/styles", label: "سبک‌ها", title: l("سبک‌ها — آتلیه رزی", "Styles — Rosie Atelier"), description: l("پترن‌ها و آثار را بر اساس سبک طراحی پیدا کنید.", "Discover patterns and works by design style.") },
  { path: "/legal/privacy", label: "حریم خصوصی", title: l("حریم خصوصی — آتلیه رزی", "Privacy — Rosie Atelier"), description: l("سیاست حفظ حریم خصوصی و استفاده از اطلاعات در آتلیه رزی.", "Rosie Atelier's privacy policy and information practices.") },
  { path: "/legal/terms", label: "شرایط استفاده", title: l("شرایط استفاده — آتلیه رزی", "Terms — Rosie Atelier"), description: l("شرایط استفاده از خدمات و وب‌سایت آتلیه رزی.", "Terms for using Rosie Atelier's website and services.") },
  { path: "/legal/licenses", label: "مجوزها", title: l("مجوزها — آتلیه رزی", "Licenses — Rosie Atelier"), description: l("شرایط و دامنهٔ مجوز استفاده از آثار آتلیه رزی.", "License terms and permitted uses for works from Rosie Atelier.") },
];

const DEFAULTS_BY_PATH = new Map(SEO_ROUTE_DEFAULTS.map((route) => [route.path, route]));

export function mergeSeoEntries(seo: readonly SeoMeta[] = []): SeoMeta[] {
  const storedByPath = new Map(seo.map((entry) => [entry.path, entry]));
  const knownPaths = new Set(SEO_ROUTE_DEFAULTS.map((route) => route.path));
  const managed = SEO_ROUTE_DEFAULTS.map((route) => {
    const stored = storedByPath.get(route.path);
    return {
      path: route.path,
      title: stored?.title ?? route.title,
      description: stored?.description ?? route.description,
    };
  });
  const additional = seo.filter((entry) => !knownPaths.has(entry.path));
  return [...managed, ...additional];
}

export function resolveSeoEntry(
  seo: readonly SeoMeta[] = [],
  path: string,
): SeoMeta | undefined {
  return seo.find((entry) => entry.path === path) ?? DEFAULTS_BY_PATH.get(path);
}

export function createSeoMetadata(
  seo: readonly SeoMeta[],
  path: string,
  locale: Locale,
  fallbackTitle: string,
  fallbackDescription?: string,
): Metadata {
  const entry = resolveSeoEntry(seo, path);
  const routeDefaults = DEFAULTS_BY_PATH.get(path);
  const title = entry?.title?.[locale]?.trim() || routeDefaults?.title[locale] || fallbackTitle;
  const description = entry?.description?.[locale]?.trim() || routeDefaults?.description[locale] || fallbackDescription;
  const canonical = `/${locale}${path === "/" ? "" : path.startsWith("/") ? path : `/${path}`}`;

  return {
    title: { absolute: title },
    ...(description ? { description } : {}),
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      ...(description ? { description } : {}),
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      ...(description ? { description } : {}),
    },
  };
}
