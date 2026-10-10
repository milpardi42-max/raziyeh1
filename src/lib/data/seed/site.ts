import type { Category, HeroContent, PortfolioHeroSettings, SiteContent } from "../../types";
import { RAZIEH_TEXTILE_CATEGORY } from "../razieh-textile-portfolio";
import { L } from "./helpers";
import { categories, spaces } from "./base";
import { artists } from "./artists";
import { patterns, products } from "./catalog";
import {
  announcementBars,
  banners,
  collections,
  education,
  homeSections,
  portfolios,
  seo,
  stories,
} from "./content";

export const hero: HeroContent = {
  eyebrow: L("استودیوی پترن و طراحی · از ۱۴۰۲", "Pattern & design studio · est. 2023"),
  titleA: L("پترن‌هایی که", "Patterns that"),
  titleB: L("فضا را روایت می‌کنند.", "tell the story of a space."),
  description: L("آتلیه رزی پلتفرم کشف پترن، محصولات دکوراتیو و همکاری با طراحان مستقل است — از سطح تا سبک زندگی.", "Rosie Atelier is a platform for discovering patterns, decorative products and collaborating with independent designers — from surface to lifestyle."),
  /* 4 paired slides: each bg matches the same-index featured pattern preview card */
  image: "/images/hero/hero-bg-01.jpg",
  images: [
    "/images/hero/hero-bg-01.jpg", // 01 pattern/wallpaper — botanical living room ↔ preview-01
    "/images/hero/hero-bg-02.jpg", // 02 pattern/wallpaper — Persian eslimi atelier ↔ preview-02
    "/images/hero/hero-bg-03.jpg", // 03 fabric/fashion — copper damask couture room ↔ preview-03
    "/images/hero/hero-bg-04.jpg", // 04 fabric/fashion — peony dress atelier ↔ preview-04
  ],
  ctaHref: "/patterns",
  cta2Href: "/portfolio",
  featuredPatternIds: ["pattern-quiet-garden", "pattern-lapis-eslimi", "pattern-copper-damask", "pattern-dusty-bloom"],
};

export const financialConfig = {
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
};

export const portfolioHero: PortfolioHeroSettings = {
  instructorCardVisible: true,
  instructorCardStyle: "invisible",
  instructorAvatarShape: "circle",
  instructorCardSize: "sm",
  videoOffsetLeft: 100,
  eyebrowFa: "روایت یک نگاه، از نقش تا فضا",
  eyebrowEn: "A creative practice, from pattern to space",
  titleLine1Fa: "از یک نقش،",
  titleLine1En: "From a pattern,",
  titleLine2Fa: "به یک جهان.",
  titleLine2En: "a world unfolds.",
  descFa: "در مرز میان هنر و زندگی؛ مجموعه‌ای از پترن‌ها، بافت‌ها و فضاها. با نگاه طراح آشنا شوید و مسیر شکل‌گیری ایده‌ها را در آثار آتلیه رزی دنبال کنید.",
  descEn: "Where art meets everyday life. Explore a collection of patterns, textures and spaces, meet the designer, and follow ideas as they take shape at Rosie Atelier.",
};

export const portfolioCategories: Category[] = [RAZIEH_TEXTILE_CATEGORY];

export const seedContent: SiteContent = {
  categories, spaces, artists, patterns, products, portfolios, portfolioCategories, education, stories, collections, homeSections, banners, seo, hero, announcementBars, financialConfig, portfolioHero,
};
