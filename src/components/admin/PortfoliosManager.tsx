"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  ExternalLink,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn, href, slugify, t } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { MediaUploadControl } from "@/components/admin/MediaUploadControl";
import { getPortfolioCategories } from "@/lib/portfolio-categories";
import type { Artist, Category, DraftStatus, Pattern, Portfolio, PortfolioBlock, Product, SiteContent } from "@/lib/types";
import type { Locale, Localized } from "@/lib/i18n/types";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */
type ViewMode = "grid" | "list";
type FilterTab = "all" | "published" | "draft" | "pending_review" | "featured";

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "پیش‌نویس",
  pending_review: "در انتظار تأیید",
  published: "منتشرشده",
  rejected: "رد شده",
};
const STATUS_COLORS: Record<DraftStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  pending_review: "bg-amber-50 text-amber-700 border border-amber-200",
  published: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-600 border border-red-200",
};

const SIZE_LABELS: Record<Portfolio["size"], string> = {
  hero: "هیرو (بزرگ)",
  tall: "بلند",
  wide: "عریض",
  square: "مربع",
};

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
function makeId() {
  return `portfolio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function localized(value?: Localized): Localized {
  return { fa: value?.fa ?? "", en: value?.en ?? "" };
}

function newPortfolioDraft(categoryId: string): Portfolio {
  return {
    id: makeId(), slug: "", title: localized(), subtitle: localized(), intro: localized(), story: [],
    cover: "", gallery: [], artistId: null, patternIds: [], productIds: [],
    client: localized(), location: localized(), year: new Date().getFullYear(), scope: localized(),
    categoryId, featured: false, isProject: false, size: "square", draftStatus: "draft",
  };
}

function normalizePortfolio(portfolio: Portfolio): Portfolio {
  return {
    ...portfolio,
    slug: portfolio.slug ?? "",
    title: localized(portfolio.title),
    subtitle: localized(portfolio.subtitle),
    intro: localized(portfolio.intro),
    story: Array.isArray(portfolio.story) ? portfolio.story.map((block) => ({
      ...block,
      ...(block.text ? { text: localized(block.text) } : {}),
      ...(block.caption ? { caption: localized(block.caption) } : {}),
      images: block.images ? [...block.images] : undefined,
    })) : [],
    cover: portfolio.cover ?? "",
    gallery: [...(portfolio.gallery ?? [])],
    artistId: portfolio.artistId ?? null,
    patternIds: [...(portfolio.patternIds ?? [])],
    productIds: [...(portfolio.productIds ?? [])],
    client: localized(portfolio.client),
    location: localized(portfolio.location),
    year: Number.isInteger(portfolio.year) ? portfolio.year : new Date().getFullYear(),
    scope: localized(portfolio.scope),
    categoryId: portfolio.categoryId ?? "",
    featured: Boolean(portfolio.featured),
    isProject: Boolean(portfolio.isProject),
    size: portfolio.size ?? "square",
    draftStatus: portfolio.draftStatus ?? "published",
  };
}

function LocalizedField({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: Localized;
  onChange: (v: Localized) => void;
  textarea?: boolean;
}) {
  const C = textarea ? Textarea : Input;
  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-2">
      <Field label={`${label} (فارسی)`}>
        <C
          dir="rtl"
          value={value.fa}
          placeholder="فارسی…"
          onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
            onChange({ ...value, fa: e.target.value })
          }
        />
      </Field>
      <Field label={`${label} (انگلیسی)`}>
        <C
          dir="ltr"
          value={value.en}
          placeholder="English…"
          onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
            onChange({ ...value, en: e.target.value })
          }
        />
      </Field>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Edit Drawer
   ────────────────────────────────────────────────────────────── */
function PortfolioEditDrawer({
  portfolio,
  artists,
  categories,
  patterns,
  products,
  portfolios,
  locale,
  onSave,
  onClose,
}: {
  portfolio: Portfolio | null;
  artists: Artist[];
  categories: Category[];
  patterns: Pattern[];
  products: Product[];
  portfolios: Portfolio[];
  locale: Locale;
  onSave: (p: Portfolio) => void;
  onClose: () => void;
}) {
  const isNew = portfolio === null;
  const [form, setForm] = useState<Portfolio>(() =>
    portfolio ? normalizePortfolio(portfolio) : newPortfolioDraft(categories[0]?.id ?? ""),
  );

  const set = useCallback(<K extends keyof Portfolio>(key: K, val: Portfolio[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  const autoSlug = () => {
    if (!form.slug && form.title.en) set("slug", makeSlug(form.title.en));
  };

  const [galleryInput, setGalleryInput] = useState(form.gallery.join("\n"));
  const [validationError, setValidationError] = useState("");

  const updateStoryBlock = (index: number, patch: Partial<PortfolioBlock>) => {
    set("story", form.story.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block));
  };
  const addStoryBlock = (type: PortfolioBlock["type"]) => {
    const block: PortfolioBlock = type === "image"
      ? { type, image: "", caption: { fa: "", en: "" } }
      : type === "pair"
      ? { type, images: ["", ""], caption: { fa: "", en: "" } }
      : { type, text: { fa: "", en: "" } };
    set("story", [...form.story, block]);
  };
  const save = () => {
    setValidationError("");
    const titleFa = form.title.fa.trim();
    const slug = slugify(form.slug.trim() || form.title.en || titleFa);
    if (!titleFa || !slug) {
      setValidationError("عنوان فارسی و اسلاگ معتبر را وارد کنید.");
      return;
    }
    if (portfolios.some((item) => item.id !== form.id && slugify(item.slug) === slug)) {
      setValidationError("این اسلاگ قبلاً برای پورتفولیوی دیگری استفاده شده است.");
      return;
    }
    if (!form.cover.trim()) {
      setValidationError("تصویر کاور را وارد یا آپلود کنید.");
      return;
    }
    if (!Number.isInteger(Number(form.year)) || Number(form.year) < 1800 || Number(form.year) > 2200) {
      setValidationError("سال پروژه باید عددی معتبر باشد.");
      return;
    }
    if (form.artistId && !artists.some((artist) => artist.id === form.artistId)) {
      setValidationError("هنرمند انتخاب‌شده در سایت موجود نیست.");
      return;
    }
    if (form.categoryId && !categories.some((category) => category.id === form.categoryId)) {
      setValidationError("دسته‌بندی انتخاب‌شده در سایت موجود نیست.");
      return;
    }
    if (form.patternIds.some((id) => !patterns.some((pattern) => pattern.id === id)) || form.productIds.some((id) => !products.some((product) => product.id === id))) {
      setValidationError("یک یا چند ارجاع پترن/محصول قدیمی است؛ آن را از ارتباط‌ها حذف یا با رکورد معتبر جایگزین کنید.");
      return;
    }
    const invalidBlock = form.story.some((block) =>
      (block.type === "text" || block.type === "quote") ? !block.text?.fa.trim() && !block.text?.en.trim()
        : block.type === "image" ? !block.image?.trim()
        : !block.images?.[0]?.trim() || !block.images?.[1]?.trim(),
    );
    if (invalidBlock) {
      setValidationError("هر بلوک داستان باید متن داشته باشد یا تصاویر لازم آن کامل شود؛ بلوک خالی را حذف کنید.");
      return;
    }
    onSave({
      ...form,
      slug,
      title: { fa: titleFa, en: form.title.en.trim() || titleFa },
      cover: form.cover.trim(),
      year: Number(form.year),
      gallery: galleryInput.split("\n").map((item) => item.trim()).filter(Boolean),
      patternIds: [...new Set(form.patternIds)],
      productIds: [...new Set(form.productIds)],
      story: form.story.map((block) => ({
        ...block,
        ...(block.text ? { text: { fa: block.text.fa.trim(), en: block.text.en.trim() || block.text.fa.trim() } } : {}),
        ...(block.caption ? { caption: { fa: block.caption.fa.trim(), en: block.caption.en.trim() || block.caption.fa.trim() } } : {}),
        ...(block.image ? { image: block.image.trim() } : {}),
        ...(block.images ? { images: block.images.map((image) => image.trim()) } : {}),
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* panel */}
      <div className="relative flex w-full max-w-2xl max-h-[92vh] flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border rounded-t-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <GalleryHorizontalEnd className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {isNew ? "پورتفولیوی جدید" : "ویرایش پورتفولیو"}
              </h2>
              {!isNew && (
                <p className="text-xs text-muted">{t(portfolio.title, "fa")}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-background-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status & Flags bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-background-secondary p-4">
            <Field label="وضعیت انتشار" className="min-w-[160px]">
              <Select
                value={form.draftStatus ?? "draft"}
                onChange={(e) => set("draftStatus", e.target.value as DraftStatus)}
              >
                {(Object.entries(STATUS_LABELS) as [DraftStatus, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="اندازه کارت" className="min-w-[140px]">
              <Select
                value={form.size}
                onChange={(e) => set("size", e.target.value as Portfolio["size"])}
              >
                {(Object.entries(SIZE_LABELS) as [Portfolio["size"], string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-4 pt-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                  className="accent-accent"
                />
                <Star className="h-3.5 w-3.5 text-amber-500" />
                منتخب
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isProject}
                  onChange={(e) => set("isProject", e.target.checked)}
                  className="accent-accent"
                />
                <Layers className="h-3.5 w-3.5 text-accent" />
                پروژه
              </label>
            </div>
            {form.draftStatus === "rejected" && <Field label="دلیل رد (اختیاری)"><Textarea value={form.rejectionNote ?? ""} onChange={(event) => set("rejectionNote", event.target.value)} /></Field>}
          </div>

          {/* Title & Slug */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">اطلاعات پایه</h3>
            <LocalizedField label="عنوان" value={form.title} onChange={(v) => set("title", v)} />
            <LocalizedField label="زیرعنوان" value={form.subtitle} onChange={(v) => set("subtitle", v)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="اسلاگ (URL)">
                <Input
                  dir="ltr"
                  value={form.slug}
                  placeholder="my-portfolio-slug"
                  onBlur={autoSlug}
                  onChange={(e) => set("slug", e.target.value)}
                />
              </Field>
              <Field label="سال پروژه">
                <Input
                  type="number"
                  dir="ltr"
                  value={form.year}
                  onChange={(e) => set("year", parseInt(e.target.value) || new Date().getFullYear())}
                />
              </Field>
            </div>
          </div>

          {/* Intro */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">معرفی پروژه</h3>
            <LocalizedField label="متن معرفی" value={form.intro} onChange={(v) => set("intro", v)} textarea />
          </div>

          {/* Story blocks */}
          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-foreground">روایت پروژه</h3><p className="mt-0.5 text-xs text-muted">بلوک‌های متنی، نقل‌قول و تصویر در صفحهٔ عمومی با همین ترتیب نمایش داده می‌شوند.</p></div><div className="flex flex-wrap gap-1.5">{([
              ["text", "متن"], ["image", "تصویر"], ["quote", "نقل‌قول"], ["pair", "دو تصویر"],
            ] as [PortfolioBlock["type"], string][]).map(([type, label]) => <Button key={type} type="button" size="sm" variant="outline" onClick={() => addStoryBlock(type)}><Plus className="h-3.5 w-3.5" />{label}</Button>)}</div></div>
            {form.story.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted">هنوز بلوکی برای روایت ثبت نشده است.</p>}
            {form.story.map((block, index) => (
              <div key={`${index}-${block.type}`} className="space-y-3 rounded-xl border border-border bg-background-secondary/40 p-3">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-xs font-semibold">بلوک {index + 1}</span><Select value={block.type} onChange={(event) => { const nextType = event.target.value as PortfolioBlock["type"]; const nextBlock: PortfolioBlock = nextType === "image" ? { type: nextType, image: "", caption: { fa: "", en: "" } } : nextType === "pair" ? { type: nextType, images: ["", ""], caption: { fa: "", en: "" } } : { type: nextType, text: { fa: "", en: "" } }; set("story", form.story.map((item, itemIndex) => itemIndex === index ? nextBlock : item)); }}>{([["text", "متن"], ["image", "تصویر"], ["quote", "نقل‌قول"], ["pair", "دو تصویر"]] as [PortfolioBlock["type"], string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><button type="button" onClick={() => set("story", form.story.filter((_, itemIndex) => itemIndex !== index))} aria-label={`حذف بلوک ${index + 1}`} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                {(block.type === "text" || block.type === "quote") && <LocalizedField label={block.type === "quote" ? "متن نقل‌قول" : "متن"} value={block.text ?? { fa: "", en: "" }} onChange={(text) => updateStoryBlock(index, { text })} textarea />}
                {block.type === "image" && <><Field label="آدرس تصویر"><Input dir="ltr" value={block.image ?? ""} onChange={(event) => updateStoryBlock(index, { image: event.target.value })} /></Field><MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => updateStoryBlock(index, { image })} /><LocalizedField label="زیرنویس" value={block.caption ?? { fa: "", en: "" }} onChange={(caption) => updateStoryBlock(index, { caption })} /></>}
                {block.type === "pair" && <><div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((imageIndex) => { const images = [block.images?.[0] ?? "", block.images?.[1] ?? ""]; return <div key={imageIndex} className="space-y-2"><Field label={`تصویر ${imageIndex + 1}`}><Input dir="ltr" value={images[imageIndex]} onChange={(event) => { const nextImages = [...images]; nextImages[imageIndex] = event.target.value; updateStoryBlock(index, { images: nextImages }); }} /></Field><MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => { const nextImages = [...images]; nextImages[imageIndex] = image; updateStoryBlock(index, { images: nextImages }); }} /></div>; })}</div><LocalizedField label="زیرنویس مشترک" value={block.caption ?? { fa: "", en: "" }} onChange={(caption) => updateStoryBlock(index, { caption })} /></>}
              </div>
            ))}
          </section>

          {/* Cover & Gallery */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">تصاویر</h3>
            <Field label="تصویر کاور (آدرس URL)">
              <Input
                dir="ltr"
                value={form.cover}
                placeholder="/images/portfolios/my-cover.jpg"
                onChange={(e) => set("cover", e.target.value)}
              />
            </Field>
            <MediaUploadControl mediaType="image" locale={locale} onUploaded={(cover) => set("cover", cover)} />
            {form.cover && (
              <div className="mt-2 mb-3 overflow-hidden rounded-lg bg-background-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.cover}
                  alt=""
                  className="h-40 w-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              </div>
            )}
            <Field label="گالری (هر آدرس در یک خط)">
              <Textarea
                dir="ltr"
                rows={3}
                value={galleryInput}
                placeholder={"/images/portfolios/img1.jpg\n/images/portfolios/img2.jpg"}
                onChange={(e) => {
                  setGalleryInput(e.target.value);
                  set("gallery", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean));
                }}
              />
            </Field>
            <div className="mt-2"><MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => { const next = [...galleryInput.split("\n").map((item) => item.trim()).filter(Boolean), image]; setGalleryInput(next.join("\n")); set("gallery", next); }} /></div>
          </div>

          {/* Meta: Client, Location, Scope */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">جزئیات پروژه</h3>
            <LocalizedField label="کارفرما / مشتری" value={form.client} onChange={(v) => set("client", v)} />
            <LocalizedField label="موقعیت مکانی" value={form.location} onChange={(v) => set("location", v)} />
            <LocalizedField label="محدوده کار" value={form.scope} onChange={(v) => set("scope", v)} />
          </div>

          {/* Category & Artist */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">دسته‌بندی و هنرمند</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="دسته‌بندی">
                <Select
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  <option value="">— بدون دسته‌بندی —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{t(c.name, "fa")}</option>
                  ))}
                </Select>
              </Field>
              <Field label="هنرمند / طراح">
                <Select
                  value={form.artistId ?? ""}
                  onChange={(e) => set("artistId", e.target.value || null)}
                >
                  <option value="">— بدون هنرمند —</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{t(a.name, "fa")}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          {/* Related records */}
          <section className="space-y-3 border-t border-border pt-5">
            <div><h3 className="text-sm font-semibold text-foreground">ارجاع‌های کاتالوگ</h3><p className="mt-0.5 text-xs text-muted">پترن‌ها و محصولات انتخاب‌شده در صفحهٔ عمومی این پروژه نمایش داده می‌شوند.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="mb-1.5 text-xs font-semibold">پترن‌های مرتبط</p><div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">{patterns.map((pattern) => <label key={pattern.id} className="flex items-center gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-background-secondary"><input type="checkbox" checked={form.patternIds.includes(pattern.id)} onChange={() => { const next = new Set(form.patternIds); if (next.has(pattern.id)) next.delete(pattern.id); else next.add(pattern.id); set("patternIds", [...next]); }} className="accent-accent" /><span className="min-w-0 flex-1 truncate">{t(pattern.title, locale)}</span><code dir="ltr" className="text-[10px] text-muted">{pattern.sku}</code></label>)}{patterns.length === 0 && <p className="p-2 text-xs text-muted">پترنی موجود نیست.</p>}</div>{form.patternIds.filter((id) => !patterns.some((pattern) => pattern.id === id)).map((id) => <div key={id} className="mt-1 flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800"><span>پترن حذف‌شده: <code dir="ltr">{id}</code></span><button type="button" onClick={() => set("patternIds", form.patternIds.filter((item) => item !== id))} className="font-semibold hover:underline">حذف ارجاع</button></div>)}</div>
              <div><p className="mb-1.5 text-xs font-semibold">محصولات مرتبط</p><div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">{products.map((product) => <label key={product.id} className="flex items-center gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-background-secondary"><input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => { const next = new Set(form.productIds); if (next.has(product.id)) next.delete(product.id); else next.add(product.id); set("productIds", [...next]); }} className="accent-accent" /><span className="min-w-0 flex-1 truncate">{t(product.title, locale)}</span><code dir="ltr" className="text-[10px] text-muted">{product.sku}</code></label>)}{products.length === 0 && <p className="p-2 text-xs text-muted">محصولی موجود نیست.</p>}</div>{form.productIds.filter((id) => !products.some((product) => product.id === id)).map((id) => <div key={id} className="mt-1 flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800"><span>محصول حذف‌شده: <code dir="ltr">{id}</code></span><button type="button" onClick={() => set("productIds", form.productIds.filter((item) => item !== id))} className="font-semibold hover:underline">حذف ارجاع</button></div>)}</div>
            </div>
          </section>
          {validationError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{validationError}</p>}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-background-secondary rounded-b-2xl px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            انصراف
          </Button>
          <div className="flex gap-2">
            {!isNew && (
              <Link
                href={href(locale, `/portfolio/${form.slug}`)}
                target="_blank"
                className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-foreground-secondary hover:bg-white hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                پیش‌نمایش
              </Link>
            )}
            <Button
              size="sm"
              onClick={save}
            >
              {isNew ? "ایجاد پورتفولیو" : "ذخیره تغییرات"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Portfolio Card (Grid view)
   ────────────────────────────────────────────────────────────── */
function PortfolioCardItem({
  p,
  artist,
  category,
  locale,
  onEdit,
  onDelete,
  onToggleFeatured,
  onToggleStatus,
}: {
  p: Portfolio;
  artist: Artist | undefined;
  category: Category | undefined;
  locale: Locale;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  onToggleStatus: (s: DraftStatus) => void;
}) {
  const status = p.draftStatus ?? "published";
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Cover */}
      <div className="relative aspect-[16/9] bg-background-secondary overflow-hidden">
        {p.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted/30" />
          </div>
        )}
        {/* Overlay actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground hover:bg-white"
            title="ویرایش"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <Link
            href={href(locale, `/portfolio/${p.slug}`)}
            target="_blank"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground hover:bg-white"
            title="مشاهده در سایت"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100"
            title="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[status])}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        {/* Featured star */}
        <button
          onClick={onToggleFeatured}
          className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 hover:bg-white"
          title={p.featured ? "حذف از منتخب" : "افزودن به منتخب"}
        >
          <Star
            className={cn("h-3.5 w-3.5", p.featured ? "fill-amber-400 text-amber-400" : "text-muted")}
          />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {t(p.title, "fa") || <span className="text-muted">بدون عنوان</span>}
          </h3>
          <span className="shrink-0 rounded-md bg-background-secondary px-2 py-0.5 text-[10px] font-medium text-muted">
            {p.year}
          </span>
        </div>
        {t(p.subtitle, "fa") && (
          <p className="line-clamp-1 text-xs text-muted">{t(p.subtitle, "fa")}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          {category && (
            <span className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] text-foreground-secondary">
              {t(category.name, "fa")}
            </span>
          )}
          {artist && (
            <span className="flex items-center gap-1 rounded-full bg-background-secondary px-2 py-0.5 text-[10px] text-foreground-secondary">
              <User className="h-3 w-3" />
              {t(artist.name, "fa")}
            </span>
          )}
          {p.isProject && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              پروژه
            </span>
          )}
          {t(p.location, "fa") && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted">
              <MapPin className="h-3 w-3" />
              {t(p.location, "fa")}
            </span>
          )}
        </div>

        {/* Quick status toggle */}
        <div className="flex gap-1.5 mt-1">
          {(["published", "draft"] as DraftStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onToggleStatus(s)}
              className={cn(
                "flex-1 rounded-md py-1 text-[10px] font-medium transition-colors",
                status === s
                  ? s === "published"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-zinc-100 text-zinc-600"
                  : "bg-background-secondary text-muted hover:bg-border",
              )}
            >
              {s === "published" ? "منتشر" : "پیش‌نویس"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Portfolio Row (List view)
   ────────────────────────────────────────────────────────────── */
function PortfolioRowItem({
  p,
  artist,
  category,
  locale,
  onEdit,
  onDelete,
  onToggleFeatured,
}: {
  p: Portfolio;
  artist: Artist | undefined;
  category: Category | undefined;
  locale: Locale;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
}) {
  const status = p.draftStatus ?? "published";
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm hover:bg-background-secondary/50">
      {/* Thumb */}
      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-background-secondary">
        {p.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted/30" />
          </div>
        )}
      </div>

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{t(p.title, "fa")}</span>
          <span className="shrink-0 rounded-full bg-background-secondary px-1.5 py-0.5 text-[10px] text-muted">
            {p.year}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          {category && <span>{t(category.name, "fa")}</span>}
          {artist && (
            <span className="flex items-center gap-0.5">
              <User className="h-3 w-3" />
              {t(artist.name, "fa")}
            </span>
          )}
          {t(p.location, "fa") && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {t(p.location, "fa")}
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_COLORS[status])}>
          {STATUS_LABELS[status]}
        </span>
        {p.isProject && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            پروژه
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onToggleFeatured}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-background-secondary"
          title={p.featured ? "حذف از منتخب" : "افزودن به منتخب"}
        >
          <Star className={cn("h-3.5 w-3.5", p.featured ? "fill-amber-400 text-amber-400" : "")} />
        </button>
        <Link
          href={href(locale, `/portfolio/${p.slug}`)}
          target="_blank"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-background-secondary"
          title="مشاهده در سایت"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-background-secondary"
          title="ویرایش"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-md text-red-400 hover:bg-red-50"
          title="حذف"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────
   Portfolio category management
   ────────────────────────────────────────────────────────────── */
function newPortfolioCategory(order: number): Category {
  const id = `portfolio-category-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  return {
    id,
    slug: "",
    name: { fa: "", en: "" },
    description: { fa: "", en: "" },
    image: "/images/collections/s04.jpg",
    featured: false,
    order,
  };
}

function PortfolioCategoryManager({
  data,
  categories,
  update,
}: {
  data: SiteContent;
  categories: Category[];
  update: (patch: Partial<SiteContent>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Category | null>(null);
  const [error, setError] = useState("");

  const save = () => {
    if (!draft || !draft.name.fa.trim()) {
      setError("عنوان فارسی دسته‌بندی را وارد کنید.");
      return;
    }
    const slug = makeSlug(draft.slug || draft.name.en) || draft.id;
    if (categories.some((category) => category.id !== draft.id && category.slug === slug)) {
      setError("این اسلاگ قبلاً برای دسته‌بندی دیگری استفاده شده است.");
      return;
    }
    const category: Category = {
      ...draft,
      slug,
      name: { fa: draft.name.fa.trim(), en: draft.name.en.trim() || draft.name.fa.trim() },
      description: { fa: draft.description.fa.trim(), en: draft.description.en.trim() },
      image: draft.image.trim() || "/images/collections/s04.jpg",
    };
    update({ portfolioCategories: [...categories.filter((item) => item.id !== category.id), category] });
    setDraft(null);
    setError("");
  };

  const remove = (category: Category) => {
    if (data.portfolios.some((portfolio) => portfolio.categoryId === category.id)) {
      alert("این دسته‌بندی به نمونه‌کارها متصل است. ابتدا دسته‌بندی آثار را تغییر دهید.");
      return;
    }
    if (!confirm(`دسته‌بندی «${category.name.fa}» حذف شود؟`)) return;
    update({ portfolioCategories: categories.filter((item) => item.id !== category.id) });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right hover:bg-background-secondary/60 sm:px-5"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">مدیریت دسته‌بندی‌های پورتفولیو</span>
          <span className="mt-1 block text-xs text-muted">عنوان، توضیحات دوزبانه و تصویر هر دسته‌بندی را تنظیم کنید · {categories.length} دسته‌بندی</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-6 text-muted">این دسته‌بندی‌ها مختص نمونه‌کارها هستند و روی دسته‌بندی محصولات و پترن‌ها تأثیری ندارند.</p>
            <Button size="sm" variant="outline" onClick={() => { setDraft(newPortfolioCategory(categories.length + 1)); setError(""); }}>
              <Plus className="h-4 w-4" />
              دسته‌بندی جدید
            </Button>
          </div>

          {draft && (
            <div className="rounded-xl border border-accent/30 bg-background-secondary/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{categories.some((item) => item.id === draft.id) ? "ویرایش دسته‌بندی" : "دسته‌بندی تازه"}</h3>
                <button type="button" onClick={() => { setDraft(null); setError(""); }} className="rounded p-1 text-muted hover:bg-white" aria-label="بستن فرم"><X className="h-4 w-4" /></button>
              </div>
              <LocalizedField label="عنوان دسته‌بندی" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
              <LocalizedField label="توضیحات" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} textarea />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="اسلاگ (اختیاری؛ از عنوان انگلیسی ساخته می‌شود)">
                  <Input dir="ltr" value={draft.slug} placeholder="textile-and-wearable-art" onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />
                </Field>
                <Field label="ترتیب نمایش">
                  <Input type="number" dir="ltr" value={draft.order} onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) || 0 })} />
                </Field>
              </div>
              <Field label="تصویر دسته‌بندی (آدرس فایل یا URL)">
                <Input dir="ltr" value={draft.image} placeholder="/images/collections/category.jpg" onChange={(event) => setDraft({ ...draft, image: event.target.value })} />
              </Field>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <MediaUploadControl mediaType="image" onUploaded={(image) => setDraft({ ...draft, image })} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setDraft(null); setError(""); }}>انصراف</Button>
                  <Button size="sm" onClick={save}>ذخیره دسته‌بندی</Button>
                </div>
              </div>
              {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
          )}

          {categories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted">هنوز دسته‌بندی‌ای برای پورتفولیو ساخته نشده است.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => {
                const worksCount = data.portfolios.filter((portfolio) => portfolio.categoryId === category.id).length;
                return (
                  <li key={category.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-background-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={category.image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{category.name.fa}</p>
                      <p className="truncate text-xs text-muted" dir="ltr">{category.name.en} · {worksCount} اثر</p>
                      {category.description.fa && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-foreground-secondary">{category.description.fa}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button type="button" onClick={() => { setDraft({ ...category, name: { ...category.name }, description: { ...category.description } }); setError(""); }} className="rounded p-1.5 text-muted hover:bg-background-secondary hover:text-foreground" title="ویرایش دسته‌بندی"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => remove(category)} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600" title="حذف دسته‌بندی"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────── */
export function PortfoliosManager({
  data,
  update,
  locale,
}: {
  data: SiteContent;
  update: (patch: Partial<SiteContent>) => void;
  locale: Locale;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Portfolio | null | "new">(null);

  const portfolios = data.portfolios;
  const artists = data.artists;
  const categories = getPortfolioCategories(data);

  /* ── Derived stats ── */
  const stats = {
    total: portfolios.length,
    published: portfolios.filter((p) => (p.draftStatus ?? "published") === "published").length,
    draft: portfolios.filter((p) => p.draftStatus === "draft").length,
    pending: portfolios.filter((p) => p.draftStatus === "pending_review").length,
    featured: portfolios.filter((p) => p.featured).length,
  };

  /* ── Filter & Search ── */
  const filtered = portfolios.filter((p) => {
    const matchTab =
      filterTab === "all" ||
      (filterTab === "published" && (p.draftStatus ?? "published") === "published") ||
      (filterTab === "draft" && p.draftStatus === "draft") ||
      (filterTab === "pending_review" && p.draftStatus === "pending_review") ||
      (filterTab === "featured" && p.featured);

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t(p.title, "fa").toLowerCase().includes(q) ||
      t(p.title, "en").toLowerCase().includes(q) ||
      t(p.client, "fa").toLowerCase().includes(q) ||
      t(p.location, "fa").toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q);

    return matchTab && matchSearch;
  });

  /* ── Mutations ── */
  const savePortfolio = useCallback(
    (p: Portfolio) => {
      const exists = portfolios.some((x) => x.id === p.id);
      const next = exists
        ? portfolios.map((x) => (x.id === p.id ? p : x))
        : [...portfolios, p];
      update({ portfolios: next });
      setEditTarget(null);
    },
    [portfolios, update],
  );

  const deletePortfolio = useCallback(
    (id: string) => {
      if (!confirm("آیا از حذف این پورتفولیو مطمئن هستید؟")) return;
      update({ portfolios: portfolios.filter((p) => p.id !== id) });
    },
    [portfolios, update],
  );

  const toggleFeatured = useCallback(
    (id: string) => {
      update({
        portfolios: portfolios.map((p) => (p.id === id ? { ...p, featured: !p.featured } : p)),
      });
    },
    [portfolios, update],
  );

  const setStatus = useCallback(
    (id: string, status: DraftStatus) => {
      update({
        portfolios: portfolios.map((p) => (p.id === id ? { ...p, draftStatus: status } : p)),
      });
    },
    [portfolios, update],
  );

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">پورتفولیوها و نمونه‌کارها</h1>
          <p className="mt-0.5 text-xs text-muted">
            معرفی پروژه‌ها، نمونه‌کارها و آثار اجراشده در سایت
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditTarget("new")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          پورتفولیوی جدید
        </Button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "کل پورتفولیوها", value: stats.total, icon: <GalleryHorizontalEnd className="h-4 w-4" />, color: "text-accent" },
          { label: "منتشرشده", value: stats.published, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-600" },
          { label: "پیش‌نویس", value: stats.draft, icon: <Edit3 className="h-4 w-4" />, color: "text-zinc-500" },
          { label: "در انتظار تأیید", value: stats.pending, icon: <Clock className="h-4 w-4" />, color: "text-amber-600" },
          { label: "منتخب", value: stats.featured, icon: <Star className="h-4 w-4" />, color: "text-amber-500" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm"
          >
            <div className={cn("shrink-0", s.color)}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-muted leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <PortfolioCategoryManager data={data} categories={categories} update={update} />

      {/* ── Filters & Search ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
          {(
            [
              ["all", "همه"],
              ["published", "منتشرشده"],
              ["draft", "پیش‌نویس"],
              ["pending_review", "در انتظار"],
              ["featured", "منتخب"],
            ] as [FilterTab, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filterTab === tab
                  ? "bg-[#1e2230] text-white"
                  : "text-foreground-secondary hover:bg-background-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در پورتفولیوها…"
              className="h-8 rounded-lg border border-border bg-white pr-8 pl-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-white p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                viewMode === "grid" ? "bg-[#1e2230] text-white" : "text-muted hover:bg-background-secondary",
              )}
              title="نمای شبکه"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                viewMode === "list" ? "bg-[#1e2230] text-white" : "text-muted hover:bg-background-secondary",
              )}
              title="نمای لیست"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-white py-16 text-center">
          <GalleryHorizontalEnd className="h-10 w-10 text-muted/30" />
          <p className="text-sm text-muted">
            {search ? "نتیجه‌ای یافت نشد" : "هنوز پورتفولیویی اضافه نشده است"}
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditTarget("new")}>
            <Plus className="h-4 w-4" />
            ایجاد اولین پورتفولیو
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PortfolioCardItem
              key={p.id}
              p={p}
              artist={artists.find((a) => a.id === p.artistId)}
              category={categories.find((c) => c.id === p.categoryId)}
              locale={locale}
              onEdit={() => setEditTarget(p)}
              onDelete={() => deletePortfolio(p.id)}
              onToggleFeatured={() => toggleFeatured(p.id)}
              onToggleStatus={(s) => setStatus(p.id, s)}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <PortfolioRowItem
              key={p.id}
              p={p}
              artist={artists.find((a) => a.id === p.artistId)}
              category={categories.find((c) => c.id === p.categoryId)}
              locale={locale}
              onEdit={() => setEditTarget(p)}
              onDelete={() => deletePortfolio(p.id)}
              onToggleFeatured={() => toggleFeatured(p.id)}
            />
          ))}
        </ul>
      )}

      {/* ── Edit Drawer ── */}
      {editTarget !== null && (
        <PortfolioEditDrawer
          portfolio={editTarget === "new" ? null : editTarget}
          artists={artists}
          categories={categories}
          patterns={data.patterns}
          products={data.products}
          portfolios={portfolios}
          locale={locale}
          onSave={savePortfolio}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
