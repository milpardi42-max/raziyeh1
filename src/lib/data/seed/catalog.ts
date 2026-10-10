import type { Pattern, Product } from "../../types";
import { L } from "./helpers";

/* ------------------------------------------------------------------ */
/* Patterns                                                             */
/* ------------------------------------------------------------------ */
const spec = (repeatFa: string, repeatEn: string, colors: number, scaleFa: string, scaleEn: string) => ({
  repeat: L(repeatFa, repeatEn), dpi: "300 DPI", formats: "AI · PDF · TIFF", colors, scale: L(scaleFa, scaleEn),
});

export const patterns: Pattern[] = [
  { id: "pattern-quiet-garden", sku: "RA-PT-0101", slug: "quiet-garden", title: L("باغ آرام", "Quiet Garden"), description: L("برگ‌های سرخس و سایه‌های گواشی روی زمینه‌ی عاجی؛ پترنی برای نشیمن‌های روشن.", "Fern fronds and gouache shadows on ivory — a pattern for bright living rooms."), image: "/images/colorways/qg-ivory.jpg", gallery: ["/images/hero/hero-preview-01.jpg", "/images/hero/hero-bg-01.jpg", "/images/patterns/p01.jpg"], categoryId: "cat-botanical", spaceIds: ["space-living-room", "space-bedroom"], artistId: "artist-niloufar-rad", price: { fa: 1850000, en: 49 }, specs: spec("۶۴ سانتی‌متر", "64 cm", 5, "بزرگ", "Large"), palette: ["#5b6f8a", "#8fa08e", "#efe9dd"], colorways: [ { id: "qg-ivory", name: L("عاجی", "Ivory"), hex: "#efe9dd", image: "/images/colorways/qg-ivory.jpg", isDefault: true }, { id: "qg-sage", name: L("سبز مریم", "Sage"), hex: "#8fa08e", image: "/images/colorways/qg-sage.jpg" }, { id: "qg-slate", name: L("سنگ‌آبی", "Slate"), hex: "#5b6f8a", image: "/images/colorways/qg-slate.jpg" }, { id: "qg-room", name: L("نشیمن روشن", "Bright room"), hex: "#c9b8a0", image: "/images/hero/hero-bg-01.jpg" }, { id: "qg-classic", name: L("کلاسیک", "Classic"), hex: "#6b7c6a", image: "/images/new/new-curtain-room.jpg" } ], tags: ["botanical", "calm"], featured: true, trending: true, bestSeller: true, isNew: false, createdAt: "2026-05-02", likes: 1240 },
  { id: "pattern-arc-lattice", sku: "RA-PT-0102", slug: "arc-lattice", title: L("شبکه‌ی کمان", "Arc Lattice"), description: L("شش‌ضلعی‌ها و کمان‌های مسی روی سرمه‌ای؛ ریتم آرت‌دکو برای فضاهای عمومی.", "Hexagons and copper arcs on navy — an art-deco rhythm for public spaces."), image: "/images/colorways/al-navy.jpg", gallery: ["/images/patterns/p02.jpg", "/images/portfolios/pf-hotel.jpg"], categoryId: "cat-geometric", spaceIds: ["space-hospitality", "space-office"], artistId: "artist-arman-kian", price: { fa: 2100000, en: 55 }, specs: spec("۳۲ سانتی‌متر", "32 cm", 3, "متوسط", "Medium"), palette: ["#1b2e4b", "#b5713a", "#f4f1ea"], colorways: [ { id: "al-navy", name: L("سرمه‌ای", "Navy"), hex: "#1b2e4b", image: "/images/colorways/al-navy.jpg", isDefault: true }, { id: "al-copper", name: L("مسی", "Copper"), hex: "#b5713a", image: "/images/new/new-fabric-geometric.jpg" }, { id: "al-ivory", name: L("عاجی", "Ivory"), hex: "#f4f1ea", image: "/images/products/fabric-geometric.jpg" }, { id: "al-hotel", name: L("هتل", "Hotel"), hex: "#3b4658", image: "/images/portfolios/pf-hotel.jpg" } ], tags: ["geometric", "deco"], featured: true, trending: true, bestSeller: false, isNew: false, createdAt: "2026-04-11", likes: 980 },
  { id: "pattern-dusty-bloom", sku: "RA-PT-0103", slug: "dusty-bloom", title: L("شکوفه‌ی غبارآلود", "Dusty Bloom"), description: L("گل‌های صدتومانی آبرنگی در مقیاس بزرگ؛ نرم و سینمایی.", "Large-scale watercolour peonies — soft and cinematic."), image: "/images/colorways/db-rose.jpg", gallery: ["/images/hero/hero-preview-04.jpg", "/images/hero/hero-bg-04.jpg", "/images/patterns/p03.jpg"], categoryId: "cat-floral", spaceIds: ["space-bedroom", "space-living-room"], artistId: "artist-sara-mehr", price: { fa: 1950000, en: 52 }, specs: spec("۹۶ سانتی‌متر", "96 cm", 6, "بزرگ", "Large"), palette: ["#c99a92", "#b86b4b", "#6b7280"], colorways: [ { id: "db-rose", name: L("رز غبارآلود", "Dusty rose"), hex: "#c99a92", image: "/images/colorways/db-rose.jpg", isDefault: true }, { id: "db-terra", name: L("تراکوتا", "Terracotta"), hex: "#b86b4b", image: "/images/colorways/db-terra.jpg" }, { id: "db-ivory", name: L("عاجی", "Ivory"), hex: "#f4f1ea", image: "/images/products/fabric-floral.jpg" }, { id: "db-bedroom", name: L("اتاق خواب", "Bedroom"), hex: "#d4a59a", image: "/images/hero/hero-bg-04.jpg" }, { id: "db-soft", name: L("صورتی ملایم", "Soft blush"), hex: "#e8c4bc", image: "/images/products/fabric-floral-2.jpg" } ], tags: ["floral", "watercolour"], featured: true, trending: false, bestSeller: true, isNew: false, createdAt: "2026-03-20", likes: 2130 },
  { id: "pattern-lapis-eslimi", sku: "RA-PT-0104", slug: "lapis-eslimi", title: L("اسلیمی لاجورد", "Lapis Eslimi"), description: L("بازخوانی مینیمال نقش کاشی ایرانی با لاجورد و طلای کهنه.", "A minimal reinterpretation of Persian tile ornament in lapis and antique gold."), image: "/images/colorways/le-lapis.jpg", gallery: ["/images/hero/hero-preview-02.jpg", "/images/hero/hero-bg-02.jpg", "/images/patterns/p04.jpg"], categoryId: "cat-persian", spaceIds: ["space-cafe", "space-hospitality"], artistId: "artist-hossein-tabrizi", price: { fa: 2400000, en: 64 }, specs: spec("۴۸ سانتی‌متر", "48 cm", 4, "متوسط", "Medium"), palette: ["#1f3a8a", "#c8a24a", "#f2ede2"], colorways: [ { id: "le-lapis", name: L("لاجورد", "Lapis"), hex: "#1f3a8a", image: "/images/colorways/le-lapis.jpg", isDefault: true }, { id: "le-gold", name: L("طلای کهنه", "Antique gold"), hex: "#c8a24a", image: "/images/colorways/le-gold.jpg" }, { id: "le-ivory", name: L("عاجی", "Ivory"), hex: "#f2ede2", image: "/images/collections/s04.jpg" }, { id: "le-corridor", name: L("راهرو", "Corridor"), hex: "#2a4494", image: "/images/hero/hero-bg-02.jpg" }, { id: "le-deep", name: L("آبی عمیق", "Deep blue"), hex: "#0f2460", image: "/images/patterns/p04.jpg" } ], tags: ["persian", "tile"], featured: true, trending: true, bestSeller: true, isNew: false, createdAt: "2026-02-14", likes: 1760 },
  { id: "pattern-torn-paper", sku: "RA-PT-0105", slug: "torn-paper", title: L("کاغذدیواری — کاغذ پاره", "Wallpaper — Torn Paper"), description: L("کاغذدیواری انتزاعی با ضربه‌قلم‌های آزاد؛ حس گالری معاصر برای نشیمن و دفتر.", "Abstract wallpaper with free brush forms — a contemporary gallery feel for living rooms and offices."), image: "/images/new/new-wallpaper-abstract.jpg", gallery: ["/images/new/new-wallpaper-abstract.jpg", "/images/patterns/p05.jpg"], categoryId: "cat-abstract", spaceIds: ["space-office", "space-living-room"], artistId: null, price: { fa: 1650000, en: 44 }, specs: spec("۶۴ سانتی‌متر", "64 cm", 4, "بزرگ", "Large"), palette: ["#2b2b2b", "#d9c7ad", "#b5713a"], colorways: [ { id: "tp-charcoal", name: L("زغالی", "Charcoal"), hex: "#2b2b2b", image: "/images/new/new-wallpaper-abstract.jpg", isDefault: true }, { id: "tp-sand", name: L("شنی", "Sand"), hex: "#d9c7ad", image: "/images/patterns/p05.jpg" }, { id: "tp-copper", name: L("مسی", "Copper"), hex: "#b5713a", image: "/images/portfolios/pf-cafe.jpg" }, { id: "tp-ink", name: L("مرکب", "Ink"), hex: "#1a1a1a", image: "/images/collections/s05.jpg" } ], tags: ["abstract"], featured: false, trending: false, bestSeller: false, isNew: true, createdAt: "2026-08-12", likes: 310 },
  { id: "pattern-hairline-grid", sku: "RA-PT-0106", slug: "hairline-grid", title: L("کاغذدیواری — شبکه‌ی مویی", "Wallpaper — Hairline Grid"), description: L("کاغذدیواری مینیمال با شبکه‌ی ظریف؛ نظم بصری برای اتاق خواب و دفتر کار.", "Minimal wallpaper with a fine hairline grid — visual calm for bedrooms and offices."), image: "/images/new/new-wallpaper-minimal.jpg", gallery: ["/images/new/new-wallpaper-minimal.jpg", "/images/patterns/p06.jpg", "/images/portfolios/pf-office.jpg"], categoryId: "cat-minimal", spaceIds: ["space-office", "space-bedroom"], artistId: null, price: { fa: 1200000, en: 32 }, specs: spec("۱۶ سانتی‌متر", "16 cm", 2, "کوچک", "Small"), palette: ["#9aa0a6", "#ffffff"], colorways: [ { id: "hg-white", name: L("سفید", "White"), hex: "#ffffff", image: "/images/new/new-wallpaper-minimal.jpg", isDefault: true }, { id: "hg-grey", name: L("خاکستری", "Grey"), hex: "#9aa0a6", image: "/images/patterns/p06.jpg" }, { id: "hg-office", name: L("دفتر", "Office"), hex: "#e8eaed", image: "/images/portfolios/pf-office.jpg" }, { id: "hg-warm", name: L("گرم", "Warm grey"), hex: "#c5c0b8", image: "/images/products/fabric-linen-minimal.jpg" } ], tags: ["minimal", "grid"], featured: false, trending: false, bestSeller: true, isNew: true, createdAt: "2026-08-20", likes: 540 },
  { id: "pattern-little-moons", sku: "RA-PT-0107", slug: "little-moons", title: L("کاغذدیواری کودک — ماه‌های کوچک", "Kids wallpaper — Little Moons"), description: L("کاغذدیواری پاستلی با ماه و بالن؛ مناسب اتاق کودک با جوهر پایه آب.", "Pastel kids wallpaper with moons and balloons — water-based inks for nurseries."), image: "/images/new/new-kids-wallpaper.jpg", gallery: ["/images/new/new-kids-wallpaper.jpg", "/images/patterns/p07.jpg", "/images/portfolios/pf-kids.jpg"], categoryId: "cat-kids", spaceIds: ["space-kids-room"], artistId: "artist-sara-mehr", price: { fa: 1450000, en: 39 }, specs: spec("۳۲ سانتی‌متر", "32 cm", 5, "متوسط", "Medium"), palette: ["#a9c1d9", "#d9a441", "#f3d9d2"], colorways: [ { id: "lm-cream", name: L("کرم", "Cream"), hex: "#f3d9d2", image: "/images/new/new-kids-wallpaper.jpg", isDefault: true }, { id: "lm-blue", name: L("آبی پودری", "Powder blue"), hex: "#a9c1d9", image: "/images/patterns/p07.jpg" }, { id: "lm-mustard", name: L("خردلی", "Mustard"), hex: "#d9a441", image: "/images/portfolios/pf-kids.jpg" }, { id: "lm-soft", name: L("صورتی ملایم", "Blush"), hex: "#f6c9c0", image: "/images/collections/s07.jpg" } ], tags: ["kids"], featured: true, trending: true, bestSeller: false, isNew: true, createdAt: "2026-08-01", likes: 890 },
  { id: "pattern-copper-damask", sku: "RA-PT-0108", slug: "copper-damask", title: L("داماسک مسی", "Copper Damask"), description: L("نقش داماسک با مس براق روی سنگ‌آبی تیره؛ برای فضاهای شبانه.", "Damask in burnished copper on deep slate — for evening spaces."), image: "/images/colorways/cd-slate.jpg", gallery: ["/images/hero/hero-preview-03.jpg", "/images/hero/hero-bg-03.jpg", "/images/patterns/p08.jpg"], categoryId: "cat-luxury", spaceIds: ["space-hospitality"], artistId: "artist-arman-kian", price: { fa: 2800000, en: 74 }, specs: spec("۶۴ سانتی‌متر", "64 cm", 3, "بزرگ", "Large"), palette: ["#1c1f26", "#b5713a", "#3b4658"], colorways: [ { id: "cd-slate", name: L("اسلیت", "Slate"), hex: "#1c1f26", image: "/images/colorways/cd-slate.jpg", isDefault: true }, { id: "cd-copper", name: L("مسی", "Copper"), hex: "#b5713a", image: "/images/products/wallpaper-damask.jpg" }, { id: "cd-navy", name: L("سرمه‌ای", "Navy"), hex: "#1b2e4b", image: "/images/colorways/cd-navy.jpg" }, { id: "cd-lobby", name: L("لابی", "Lobby"), hex: "#3b4658", image: "/images/products/wallpaper-damask-2.jpg" }, { id: "cd-velvet", name: L("مخمل", "Velvet night"), hex: "#0e1118", image: "/images/products/curtain-velvet.jpg" } ], tags: ["luxury", "damask"], featured: true, trending: false, bestSeller: true, isNew: false, createdAt: "2026-01-30", likes: 1420 },
];

/* ------------------------------------------------------------------ */
/* Products — wallpaper · fabric · curtain · décor                      */
/* ------------------------------------------------------------------ */
const color = (id: string, fa: string, en: string, hex: string, image: string, stock = 12) => ({ id, name: L(fa, en), hex, image, stock });

export const products: Product[] = [
  {
    id: "product-wallpaper-quiet-garden", sku: "RA-WP-2001", slug: "wallpaper-quiet-garden",
    title: L("کاغذدیواری — باغ آرام", "Wallpaper — Quiet Garden"),
    description: L("کاغذدیواری نان‌وون پریمیوم با پترن گیاهی باغ آرام؛ مناسب نشیمن و اتاق خواب روشن.", "Premium non-woven wallpaper with the Quiet Garden botanical — ideal for bright living rooms and bedrooms."),
    categoryId: "cat-botanical", familyId: "fam-wallpaper", patternId: "pattern-quiet-garden", artistId: "artist-niloufar-rad",
    price: { fa: 2450000, en: 89 }, compareAt: { fa: 2750000, en: 99 },
    colors: [
      color("ivory", "عاجی", "Ivory", "#efe9dd", "/images/colorways/qg-ivory.jpg"),
      color("sage", "سبز مریم", "Sage", "#8fa08e", "/images/colorways/qg-sage.jpg", 6),
      color("slate", "سنگ‌آبی", "Slate", "#5b6f8a", "/images/colorways/qg-slate.jpg", 4),
      color("room", "نشیمن", "Living room", "#c9b8a0", "/images/hero/hero-bg-01.jpg", 5),
    ],
    sizes: [L("رول ۱۰٫۰۵×۰٫۵۳ م", "Roll 10.05×0.53 m"), L("متر مربع", "Per m²")],
    specs: [
      { label: L("متریال", "Material"), value: L("نان‌وون ۲۰۰ گرم", "200 gsm non-woven") },
      { label: L("تکرار", "Repeat"), value: L("۶۴ سانتی‌متر", "64 cm") },
      { label: L("نصب", "Install"), value: L("چسب روی دیوار", "Paste the wall") },
    ],
    materials: L("نان‌وون پریمیوم، جوهر پایه آب، قابل شست‌وشوی ملایم", "Premium non-woven, water-based ink, gently washable"),
    featured: true, bestSeller: true, isNew: false, order: 1,
  },
  {
    id: "product-wallpaper-copper-damask", sku: "RA-WP-2002", slug: "wallpaper-copper-damask",
    title: L("کاغذدیواری — داماسک مسی", "Wallpaper — Copper Damask"),
    description: L("کاغذدیواری لوکس با نقش داماسک مسی روی اسلیت تیره؛ برای لابی، هتل و فضاهای شبانه.", "Luxury wallpaper with copper damask on deep slate — for lobbies, hotels and evening spaces."),
    categoryId: "cat-luxury", familyId: "fam-wallpaper", patternId: "pattern-copper-damask", artistId: "artist-arman-kian",
    price: { fa: 3200000, en: 118 },
    colors: [
      color("slate", "اسلیت", "Slate", "#1c1f26", "/images/colorways/cd-slate.jpg"),
      color("navy", "سرمه‌ای", "Navy", "#1b2e4b", "/images/colorways/cd-navy.jpg", 5),
      color("copper", "مسی", "Copper", "#b5713a", "/images/products/wallpaper-damask.jpg", 3),
      color("lobby", "لابی", "Lobby", "#3b4658", "/images/hero/hero-bg-03.jpg", 4),
    ],
    sizes: [L("رول ۱۰٫۰۵×۰٫۵۳ م", "Roll 10.05×0.53 m"), L("متر مربع", "Per m²")],
    specs: [
      { label: L("متریال", "Material"), value: L("وینیل تجاری B1", "Commercial vinyl B1") },
      { label: L("تکرار", "Repeat"), value: L("۶۴ سانتی‌متر", "64 cm") },
      { label: L("مقاومت", "Durability"), value: L("ضدخش · scrubbable", "Anti-scratch · scrubbable") },
    ],
    materials: L("وینیل تجاری کلاس B1، چاپ دیجیتال ۱۲ رنگ", "Class B1 commercial vinyl, 12-ink digital print"),
    featured: true, bestSeller: true, isNew: false, order: 2,
  },
  {
    id: "product-fabric-dusty-bloom", sku: "RA-FB-2003", slug: "fabric-dusty-bloom",
    title: L("طراحی پارچه — شکوفه‌ی غبارآلود", "Fabric design — Dusty Bloom"),
    description: L("پارچه کتان چاپی با گل‌های صدتومانی آبرنگی؛ مناسب روکش مبل، کوسن و لباس خانگی.", "Printed linen with watercolour peonies — for upholstery, cushions and home apparel."),
    categoryId: "cat-floral", familyId: "fam-home-fabric", patternId: "pattern-dusty-bloom", artistId: "artist-sara-mehr",
    price: { fa: 980000, en: 48 },
    colors: [
      color("rose", "رز غبارآلود", "Dusty rose", "#c99a92", "/images/colorways/db-rose.jpg"),
      color("terracotta", "تراکوتا", "Terracotta", "#b86b4b", "/images/colorways/db-terra.jpg", 7),
      color("ivory", "عاجی", "Ivory", "#f4f1ea", "/images/new/new-fabric-roll.jpg", 4),
      color("soft", "صورتی ملایم", "Blush", "#e8c4bc", "/images/products/fabric-floral.jpg", 6),
    ],
    sizes: [L("عرض ۱۴۰ سانتی‌متر", "140 cm width"), L("هر متر طولی", "Per linear metre")],
    specs: [
      { label: L("جنس", "Fabric"), value: L("کتان اروپایی", "European linen") },
      { label: L("وزن", "Weight"), value: L("۲۲۰ گرم/م²", "220 gsm") },
      { label: L("چاپ", "Print"), value: L("پیگمنت ماندگار", "Durable pigment") },
    ],
    materials: L("کتان ۱۰۰٪، چاپ پیگمنت، نرم‌شو با آب سرد", "100% linen, pigment print, cold wash"),
    featured: true, bestSeller: true, isNew: true, order: 3,
  },
  {
    id: "product-fabric-arc-lattice", sku: "RA-FB-2004", slug: "fabric-arc-lattice",
    title: L("طراحی پارچه — شبکه‌ی کمان", "Fabric design — Arc Lattice"),
    description: L("پارچه مبلی با پترن هندسی آرت‌دکو؛ مس و سرمه‌ای برای مبلمان و پنل دیواری.", "Upholstery fabric with art-deco geometry — copper and navy for seating and wall panels."),
    categoryId: "cat-geometric", familyId: "fam-home-fabric", patternId: "pattern-arc-lattice", artistId: "artist-arman-kian",
    price: { fa: 1250000, en: 58 },
    colors: [
      color("navy", "سرمه‌ای", "Navy", "#1b2e4b", "/images/colorways/al-navy.jpg"),
      color("copper", "مسی", "Copper", "#b5713a", "/images/new/new-fabric-geometric.jpg"),
      color("ivory", "عاجی", "Ivory", "#f4f1ea", "/images/products/fabric-geometric.jpg", 5),
      color("hotel", "هتل", "Hotel", "#3b4658", "/images/portfolios/pf-hotel.jpg", 4),
    ],
    sizes: [L("عرض ۱۵۰ سانتی‌متر", "150 cm width"), L("هر متر طولی", "Per linear metre")],
    specs: [
      { label: L("جنس", "Fabric"), value: L("پلی‌کتان مبلی", "Upholstery poly-linen") },
      { label: L("مقاومت", "Martindale"), value: L("۴۰٬۰۰۰ دور", "40,000 cycles") },
      { label: L("کاربرد", "Use"), value: L("مبل · پنل", "Seating · panel") },
    ],
    materials: L("پلی‌کتان با دوام بالا، چاپ دیجیتال", "High-durability poly-linen, digital print"),
    featured: true, bestSeller: false, isNew: true, order: 4,
  },
  {
    id: "product-curtain-quiet-garden", sku: "RA-CR-2005", slug: "curtain-quiet-garden",
    title: L("پرده — باغ آرام", "Curtain — Quiet Garden"),
    description: L("پرده کتان دو‌لایه با چاپ گیاهی ظریف؛ نور ملایم، آستر مات و دوخت سفارشی.", "Double-layer linen curtain with a soft botanical print; gentle light, blackout lining, made to measure."),
    categoryId: "cat-botanical", familyId: "fam-curtain", patternId: "pattern-quiet-garden", artistId: null,
    price: { fa: 4200000, en: 195 },
    colors: [
      color("ivory", "عاجی", "Ivory", "#efe9dd", "/images/new/new-curtain-room.jpg"),
      color("sage", "سبز مریم", "Sage", "#8fa08e", "/images/products/curtain-linen-2.jpg", 6),
      color("sheer", "شفاف", "Sheer", "#f7f3ea", "/images/products/curtain-sheer.jpg", 8),
    ],
    sizes: [L("عرض ۲٫۵ م", "W 2.5 m"), L("عرض ۳٫۵ م", "W 3.5 m"), L("سفارشی", "Custom")],
    specs: [
      { label: L("جنس", "Fabric"), value: L("کتان + آستر", "Linen + lining") },
      { label: L("ارتفاع", "Drop"), value: L("تا ۳٫۲۰ م", "Up to 3.20 m") },
      { label: L("دوخت", "Finish"), value: L("پلیسه · حلقه", "Pinch · eyelet") },
    ],
    materials: L("کتان اروپایی، آستر مات، نوار پرده پنبه‌ای", "European linen, blackout lining, cotton heading tape"),
    featured: true, bestSeller: true, isNew: true, order: 5,
  },
  {
    id: "product-curtain-copper-damask", sku: "RA-CR-2006", slug: "curtain-copper-damask",
    title: L("پرده مخمل — داماسک مسی", "Velvet curtain — Copper Damask"),
    description: L("پرده مخمل سنگین با نقش داماسک؛ عمق شبانه برای اتاق خواب و سالن پذیرایی لوکس.", "Heavy velvet curtain with damask motif — nocturnal depth for bedrooms and formal lounges."),
    categoryId: "cat-luxury", familyId: "fam-curtain", patternId: "pattern-copper-damask", artistId: null,
    price: { fa: 5800000, en: 265 },
    colors: [
      color("navy", "سرمه‌ای", "Navy", "#1b2e4b", "/images/products/curtain-velvet.jpg"),
      color("slate", "اسلیت", "Slate", "#3b4658", "/images/products/curtain-velvet-2.jpg", 4),
      color("black", "مشکی", "Black", "#1c1f26", "/images/products/lamp-1.jpg", 3),
    ],
    sizes: [L("عرض ۲٫۸ م", "W 2.8 m"), L("عرض ۳٫۶ م", "W 3.6 m"), L("سفارشی", "Custom")],
    specs: [
      { label: L("جنس", "Fabric"), value: L("مخمل ۳۲۰ گرم", "320 gsm velvet") },
      { label: L("آستر", "Lining"), value: L("مات کامل", "Full blackout") },
      { label: L("دوخت", "Finish"), value: L("پلیسه سه‌تایی", "Triple pinch") },
    ],
    materials: L("مخمل پلی‌استر پریمیوم، آستر مات، وزنه‌ی سربی", "Premium poly velvet, blackout lining, lead-weight hem"),
    featured: true, bestSeller: false, isNew: false, order: 6,
  },
  {
    id: "product-decor-cushion-set", sku: "RA-DC-2007", slug: "decor-cushion-set",
    title: L("ست دکور — کوسن‌های پترن", "Décor set — Pattern cushions"),
    description: L("ست سه‌تایی کوسن با پترن‌های گیاهی و داماسک؛ ترکیب کتان و مخمل برای نشیمن کلاسیک.", "Set of three cushions in botanical and damask patterns — linen and velvet mix for a classical lounge."),
    categoryId: "cat-botanical", familyId: "fam-cushion", patternId: "pattern-quiet-garden", artistId: null,
    price: { fa: 1890000, en: 86 }, compareAt: { fa: 2200000, en: 98 },
    colors: [
      color("mixed", "ترکیبی", "Mixed", "#c99a92", "/images/new/new-decor-set.jpg"),
      color("ivory", "عاجی", "Ivory", "#efe9dd", "/images/products/cushion-0.jpg"),
      color("sage", "سبز مریم", "Sage", "#8fa08e", "/images/products/decor-vase.jpg", 5),
    ],
    sizes: [L("۴۵×۴۵ ×۳", "45×45 ×3"), L("۵۰×۵۰ ×۳", "50×50 ×3")],
    specs: [
      { label: L("تعداد", "Pieces"), value: L("۳ کوسن", "3 cushions") },
      { label: L("جنس", "Fabric"), value: L("کتان · مخمل", "Linen · velvet") },
      { label: L("پر", "Fill"), value: L("الیاف طبیعی", "Natural fibre") },
    ],
    materials: L("کتان و مخمل، زیپ نامرئی، پر الیاف طبیعی", "Linen & velvet, invisible zip, natural fibre fill"),
    featured: true, bestSeller: true, isNew: true, order: 7,
  },
  {
    id: "product-decor-lapis-rug", sku: "RA-DC-2008", slug: "decor-lapis-rug",
    title: L("دکور — فرش اسلیمی لاجورد", "Décor — Lapis Eslimi rug"),
    description: L("فرش تافتینگ با نقش اسلیمی لاجورد؛ قطعه‌ی دکوراتیو برای ورودی، نشیمن و فضاهای لوکس.", "Tufted rug with lapis eslimi motif — a décor centrepiece for entries, lounges and luxury spaces."),
    categoryId: "cat-persian", patternId: "pattern-lapis-eslimi", artistId: "artist-hossein-tabrizi",
    price: { fa: 6800000, en: 320 },
    colors: [
      color("lapis", "لاجورد", "Lapis", "#1f3a8a", "/images/products/decor-rug.jpg"),
      color("gold", "طلای کهنه", "Antique gold", "#c8a24a", "/images/products/rug-1.jpg", 2),
      color("ivory", "عاجی", "Ivory", "#f2ede2", "/images/products/rug-2.jpg"),
    ],
    sizes: [L("۱۲۰×۱۸۰", "120×180"), L("۱۶۰×۲۳۰", "160×230")],
    specs: [
      { label: L("جنس", "Material"), value: L("پشم ۸۰٪ / پنبه ۲۰٪", "80% wool / 20% cotton") },
      { label: L("پرز", "Pile"), value: L("۱۲ میلی‌متر", "12 mm") },
      { label: L("ساخت", "Made in"), value: L("تبریز", "Tabriz") },
    ],
    materials: L("پشم دستریس، پنبه، زیره‌ی نمدی", "Hand-spun wool, cotton, felt backing"),
    featured: true, bestSeller: false, isNew: false, order: 8,
  },
  {
    id: "product-wallpaper-lapis-eslimi", sku: "RA-WP-2009", slug: "wallpaper-lapis-eslimi",
    title: L("کاغذدیواری — اسلیمی لاجورد", "Wallpaper — Lapis Eslimi"),
    description: L("کاغذدیواری با بازخوانی مینیمال نقش کاشی ایرانی؛ لاجورد و طلای کهنه برای فضاهای خاص.", "Wallpaper reinterpreting Persian tile ornament in lapis and antique gold — for distinctive interiors."),
    categoryId: "cat-persian", familyId: "fam-wallpaper", patternId: "pattern-lapis-eslimi", artistId: "artist-hossein-tabrizi",
    price: { fa: 2900000, en: 108 },
    colors: [
      color("lapis", "لاجورد", "Lapis", "#1f3a8a", "/images/colorways/le-lapis.jpg"),
      color("gold", "طلای کهنه", "Antique gold", "#c8a24a", "/images/colorways/le-gold.jpg", 4),
      color("ivory", "عاجی", "Ivory", "#f2ede2", "/images/collections/s04.jpg", 6),
      color("deep", "آبی عمیق", "Deep blue", "#0f2460", "/images/hero/hero-bg-02.jpg", 3),
    ],
    sizes: [L("رول ۱۰٫۰۵×۰٫۵۳ م", "Roll 10.05×0.53 m"), L("متر مربع", "Per m²")],
    specs: [
      { label: L("متریال", "Material"), value: L("نان‌وون بافت‌دار", "Textured non-woven") },
      { label: L("تکرار", "Repeat"), value: L("۴۸ سانتی‌متر", "48 cm") },
      { label: L("نصب", "Install"), value: L("چسب روی دیوار", "Paste the wall") },
    ],
    materials: L("نان‌وون بافت‌دار، جوهر پایه آب، مات", "Textured non-woven, water-based ink, matte"),
    featured: true, bestSeller: true, isNew: false, order: 9,
  },
  {
    id: "product-decor-atelier-lamp", sku: "RA-DC-2010", slug: "decor-atelier-lamp",
    title: L("دکور — آباژور داماسک", "Décor — Damask lamp"),
    description: L("آباژور رومیزی با کلاهک پارچه‌ای داماسک و پایه‌ی برنجی مات؛ قطعه‌ی نهایی برای کنار مبل یا پاتختی.", "Table lamp with damask fabric shade and matte brass base — the finishing piece beside a sofa or bed."),
    categoryId: "cat-luxury", patternId: "pattern-copper-damask", artistId: null,
    price: { fa: 3200000, en: 145 },
    colors: [
      color("slate", "سنگ‌آبی", "Slate", "#3b4658", "/images/new/new-lamp-decor.jpg"),
      color("black", "مشکی", "Black", "#1c1f26", "/images/products/lamp-1.jpg", 5),
      color("copper", "مسی", "Copper", "#b5713a", "/images/products/lamp-2.jpg"),
    ],
    sizes: [L("۴۵ سانتی‌متر", "45 cm")],
    specs: [
      { label: L("پایه", "Base"), value: L("برنج مات", "Matte brass") },
      { label: L("کلاهک", "Shade"), value: L("پارچه داماسک", "Damask fabric") },
      { label: L("سرپیچ", "Socket"), value: L("E27", "E27") },
    ],
    materials: L("برنج، پارچه پلی‌کتان، کابل پارچه‌ای", "Brass, poly-linen, fabric cord"),
    featured: true, bestSeller: false, isNew: true, order: 10,
  },
];

/* ------------------------------------------------------------------ */
/* Portfolios                                                           */
/* ------------------------------------------------------------------ */
