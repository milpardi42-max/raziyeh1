import type { Category, Space } from "../../types";
import { L } from "./helpers";

/* ------------------------------------------------------------------ */
/* Categories (Styles) — manageable from Admin                          */
/* ------------------------------------------------------------------ */
export const categories: Category[] = [
  { id: "cat-minimal", slug: "minimal", name: L("مینیمال", "Minimal"), description: L("خطوط آرام، فضای خالی، جزئیات ظریف.", "Quiet lines, open space, fine detail."), image: "/images/collections/s06.jpg", featured: true, order: 1 },
  { id: "cat-botanical", slug: "botanical", name: L("گیاهی", "Botanical"), description: L("برگ، سرخس و باغ‌های نقاشی‌شده.", "Leaves, ferns and painted gardens."), image: "/images/collections/s01.jpg", featured: true, order: 2 },
  { id: "cat-geometric", slug: "geometric", name: L("هندسی", "Geometric"), description: L("ریتم، تقارن و ساختار.", "Rhythm, symmetry and structure."), image: "/images/collections/s02.jpg", featured: true, order: 3 },
  { id: "cat-floral", slug: "floral", name: L("گل‌دار", "Floral"), description: L("گل‌های آبرنگی در مقیاس بزرگ.", "Large-scale watercolour blooms."), image: "/images/collections/s03.jpg", featured: true, order: 4 },
  { id: "cat-abstract", slug: "abstract", name: L("انتزاعی", "Abstract"), description: L("فرم‌های آزاد و بافت دست.", "Free forms and hand texture."), image: "/images/collections/s05.jpg", featured: true, order: 5 },
  { id: "cat-persian", slug: "persian-inspired", name: L("ایرانی", "Persian Inspired"), description: L("اسلیمی، بته‌جقه و کاشی؛ بازخوانی معاصر.", "Eslimi, boteh and tile — reinterpreted."), image: "/images/collections/s04.jpg", featured: true, order: 6 },
  { id: "cat-luxury", slug: "luxury", name: L("لوکس", "Luxury"), description: L("داماسک، فلز و عمق.", "Damask, metal and depth."), image: "/images/collections/s08.jpg", featured: true, order: 7 },
  { id: "cat-kids", slug: "kids", name: L("کودک", "Kids"), description: L("ماه، ابر و بالن‌های کوچک.", "Moons, clouds and little balloons."), image: "/images/collections/s07.jpg", featured: true, order: 8 },
  { id: "cat-nature", slug: "nature", name: L("طبیعت", "Nature"), description: L("الهام از زمین، سنگ و آب.", "Earth, stone and water."), image: "/images/collections/s01.jpg", featured: false, order: 9 },
  { id: "cat-contemporary", slug: "contemporary", name: L("معاصر", "Contemporary"), description: L("زبان امروز طراحی سطح.", "Today's language of surface design."), image: "/images/collections/s05.jpg", featured: false, order: 10 },
];

export const spaces: Space[] = [
  { id: "space-living-room", slug: "living-room", name: L("نشیمن", "Living room"), image: "/images/products/wallpaper-botanical.jpg", order: 1 },
  { id: "space-bedroom", slug: "bedroom", name: L("اتاق خواب", "Bedroom"), image: "/images/portfolios/pf-bedroom.jpg", order: 2 },
  { id: "space-kids-room", slug: "kids-room", name: L("اتاق کودک", "Kids room"), image: "/images/portfolios/pf-kids.jpg", order: 3 },
  { id: "space-office", slug: "office", name: L("دفتر کار", "Office"), image: "/images/portfolios/pf-office.jpg", order: 4 },
  { id: "space-hospitality", slug: "hospitality", name: L("هتل و رستوران", "Hospitality"), image: "/images/portfolios/pf-hotel.jpg", order: 5 },
  { id: "space-cafe", slug: "cafe", name: L("کافه", "Café"), image: "/images/portfolios/pf-cafe.jpg", order: 6 },
];

