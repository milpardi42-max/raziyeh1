import type { Category, Portfolio } from "@/lib/types";

const L = (fa: string, en: string) => ({ fa, en });

export const RAZIEH_TEXTILE_CATEGORY: Category = {
  id: "portfolio-cat-textile-wearable-art",
  slug: "textile-wearable-art",
  name: L("پارچه و هنر پوشیدنی", "Textile & Wearable Art"),
  description: L(
    "از ساخت و رنگ‌آمیزی پارچه تا طراحی جلیقه؛ روایت پیوند رنگ، بافت و فرم در کارهای راضیه خیری‌پور.",
    "From fabric construction and colour work to vest design: Razieh Khairipour's exploration of colour, texture and form.",
  ),
  image: "/images/portfolios/razieh-textile-atelier.jpg",
  featured: false,
  order: 1,
};

/** Editorial portfolio introduction; it describes the artist's practice, not a claimed client commission. */
export const RAZIEH_TEXTILE_PORTFOLIO: Portfolio = {
  showcase: "site",
  id: "portfolio-razieh-textile-and-vest-design",
  slug: "razieh-textile-and-vest-design",
  title: L("از نخ و رنگ تا پوشاک", "From Thread and Colour to Garment"),
  subtitle: L("روایت طراحی پارچه و جلیقه به دست راضیه خیری‌پور", "A textile and vest design practice by Razieh Khairipour"),
  intro: L(
    "برای راضیه خیری‌پور، پارچه نقطهٔ آغاز یک مسیر خلاقانه است؛ مسیری که از ساخت و رنگ‌آمیزی پارچه می‌گذرد و در طراحی جلیقه به فرم و پوشاک می‌رسد. این پرونده، نگاهی آرام و دقیق به همراهی رنگ، بافت و کاربرد دارد؛ جایی که کیفیت لمس پارچه در کنار تناسب فرم، هویت هر اثر را شکل می‌دهد.",
    "For Razieh Khairipour, fabric is the beginning of a creative journey: from making and colouring cloth to shaping it into a considered vest design. This portfolio offers a quiet, attentive look at colour, texture and wearability, where the feel of the textile and the balance of the silhouette work together.",
  ),
  story: [
    {
      type: "text",
      text: L(
        "رنگ، نخستین لایهٔ روایت است. انتخاب پالت و آزمودن آن روی پارچه، فضایی می‌سازد تا نقش و بافت با هم دیده شوند؛ نه جدا از هم.",
        "Colour is the first layer of the story. Developing a palette on cloth lets pattern and texture be considered together, rather than as separate decisions.",
      ),
    },
    {
      type: "image",
      image: "/images/portfolios/razieh-textile-process.jpg",
      caption: L("نمونه‌رنگ‌ها و بافت؛ بخشی از مسیر طراحی", "Colour studies and cloth: a glimpse into the design process"),
    },
    {
      type: "text",
      text: L(
        "از ساخت پارچه تا طراحی جلیقه، توجه به حرکت و راحتی در کنار ظاهر اثر اهمیت دارد. فرم نهایی باید هم با شخصیت پارچه هماهنگ باشد و هم برای پوشیدن، طبیعی و خوش‌نشست بماند.",
        "From fabric construction to vest design, movement and comfort matter as much as appearance. The final silhouette should honour the character of the cloth and feel natural to wear.",
      ),
    },
    {
      type: "image",
      image: "/images/portfolios/razieh-textile-atelier.jpg",
      caption: L("پارچه، رنگ و فرم در یک قاب", "Fabric, colour and form in one frame"),
    },
  ],
  cover: "/images/portfolios/razieh-textile-atelier.jpg",
  gallery: [
    "/images/portfolios/razieh-textile-atelier.jpg",
    "/images/portfolios/razieh-textile-process.jpg",
  ],
  artistId: "artist-razieh-khairipour",
  patternIds: [],
  productIds: [],
  client: L("", ""),
  location: L("تهران", "Tehran"),
  year: 2026,
  scope: L("ساخت پارچه، رنگ‌آمیزی و طراحی جلیقه", "Fabric construction, colour work and vest design"),
  categoryId: RAZIEH_TEXTILE_CATEGORY.id,
  featured: true,
  isProject: false,
  size: "tall",
};
