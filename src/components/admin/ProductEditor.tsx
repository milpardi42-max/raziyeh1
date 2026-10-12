"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { MediaUploadControl } from "@/components/admin/MediaUploadControl";
import { FirstProductVariantFields, EMPTY_FIRST_PRODUCT_VARIANT, type FirstProductVariantFormValues } from "@/components/admin/FirstProductVariantFields";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { PRODUCT_FAMILIES } from "@/lib/data/families";
import { buildProductWithFirstVariant, type FirstProductVariantError } from "@/lib/product-variants";
import { slugify, t } from "@/lib/utils";
import { hasUniqueIds } from "@/lib/admin-editor-validation";
import type { Artist, Category, ColorOption, Pattern, Product, ProductSpec } from "@/lib/types";
import type { Locale, Localized } from "@/lib/i18n/types";

function LocalizedFields({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: Localized;
  onChange: (next: Localized) => void;
  textarea?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} (فارسی)`}>
        {textarea
          ? <Textarea dir="rtl" value={value.fa} onChange={(event) => onChange({ ...value, fa: event.target.value })} />
          : <Input dir="rtl" value={value.fa} onChange={(event) => onChange({ ...value, fa: event.target.value })} />}
      </Field>
      <Field label={`${label} (انگلیسی)`}>
        {textarea
          ? <Textarea dir="ltr" value={value.en} onChange={(event) => onChange({ ...value, en: event.target.value })} />
          : <Input dir="ltr" value={value.en} onChange={(event) => onChange({ ...value, en: event.target.value })} />}
      </Field>
    </div>
  );
}

function emptyColor(): ColorOption {
  return {
    id: `color-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: { fa: "", en: "" },
    hex: "#8fa08e",
    image: "",
    stock: 0,
  };
}

function emptySpec(): ProductSpec {
  return { label: { fa: "", en: "" }, value: { fa: "", en: "" } };
}

export function ProductEditor({
  product,
  products,
  categories,
  patterns,
  artists,
  locale,
  onSave,
  onClose,
}: {
  product: Product;
  products: Product[];
  categories: Category[];
  patterns: Pattern[];
  artists: Artist[];
  locale: Locale;
  onSave: (product: Product) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Product>(() => ({
    ...product,
    title: { fa: product.title?.fa ?? "", en: product.title?.en ?? "" },
    description: { fa: product.description?.fa ?? "", en: product.description?.en ?? "" },
    price: { fa: product.price?.fa ?? 0, en: product.price?.en ?? 0 },
    compareAt: product.compareAt ? { fa: product.compareAt.fa ?? 0, en: product.compareAt.en ?? 0 } : undefined,
    colors: product.colors?.map((color) => ({ ...color, name: { fa: color.name?.fa ?? "", en: color.name?.en ?? "" }, stock: Number(color.stock) || 0 })) ?? [],
    sizes: product.sizes?.map((size) => ({ fa: size.fa ?? "", en: size.en ?? "" })) ?? [],
    specs: product.specs?.map((spec) => ({ label: { fa: spec.label?.fa ?? "", en: spec.label?.en ?? "" }, value: { fa: spec.value?.fa ?? "", en: spec.value?.en ?? "" } })) ?? [],
    materials: { fa: product.materials?.fa ?? "", en: product.materials?.en ?? "" },
  }));
  const [hasCompareAt, setHasCompareAt] = useState(Boolean(product.compareAt));
  const [firstVariantOpen, setFirstVariantOpen] = useState(false);
  const [firstVariant, setFirstVariant] = useState<FirstProductVariantFormValues>({ ...EMPTY_FIRST_PRODUCT_VARIANT });
  const [variantError, setVariantError] = useState<FirstProductVariantError | null>(null);
  const [error, setError] = useState("");

  const set = <K extends keyof Product>(key: K, value: Product[K]) => setForm((current) => ({ ...current, [key]: value }));

  const addFirstVariant = () => {
    const { colors, ...productBase } = form;
    void colors;
    const result = buildProductWithFirstVariant(productBase, {
      id: `color-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      nameFa: firstVariant.nameFa,
      nameEn: firstVariant.nameEn,
      hex: firstVariant.hex,
      image: firstVariant.image,
      stock: firstVariant.stock,
    });
    if (!result.ok) {
      setVariantError(result.error);
      return;
    }
    set("colors", result.product.colors);
    setVariantError(null);
    setFirstVariantOpen(false);
  };

  const updateColor = (colorId: string, patch: Partial<ColorOption>) => {
    set("colors", form.colors.map((color) => color.id === colorId ? { ...color, ...patch } : color));
  };

  const save = () => {
    if (firstVariantOpen) {
      setError("برای ثبت محصول ابتدا فرم واریانت اول را ذخیره یا از آن انصراف دهید.");
      return;
    }
    const titleFa = form.title.fa.trim();
    const sku = form.sku.trim();
    const slug = slugify(form.slug.trim() || form.title.en || titleFa);
    if (!titleFa || !sku || !slug) {
      setError("عنوان فارسی، SKU و اسلاگ معتبر را وارد کنید.");
      return;
    }
    if (!categories.some((category) => category.id === form.categoryId)) {
      setError("برای محصول دسته‌بندی معتبر انتخاب کنید.");
      return;
    }
    if (products.some((item) => item.id !== form.id && item.sku.trim().toLowerCase() === sku.toLowerCase())) {
      setError("این SKU قبلاً استفاده شده است.");
      return;
    }
    if (products.some((item) => item.id !== form.id && slugify(item.slug) === slug)) {
      setError("این اسلاگ قبلاً برای محصول دیگری استفاده شده است.");
      return;
    }
    if (form.patternId && !patterns.some((pattern) => pattern.id === form.patternId)) {
      setError("پترن پیوندشده دیگر در کاتالوگ نیست؛ ارتباط را اصلاح کنید.");
      return;
    }
    if (form.artistId && !artists.some((artist) => artist.id === form.artistId)) {
      setError("هنرمند انتخاب‌شده دیگر در کاتالوگ نیست.");
      return;
    }
    const invalidColor = form.colors.find((color) =>
      !color.id.trim() || !color.name.fa.trim()
      || !/^#[\da-f]{6}$/i.test(color.hex) || !color.image.trim()
      || !Number.isSafeInteger(Number(color.stock)) || Number(color.stock) < 0,
    );
    if (invalidColor) {
      setError("هر رنگ‌بندی باید نام فارسی، رنگ معتبر، تصویر و موجودی صحیح صفر یا بیشتر داشته باشد؛ نام انگلیسی خالی از فارسی تکمیل می‌شود.");
      return;
    }
    if (!hasUniqueIds(form.colors)) {
      setError("شناسهٔ رنگ‌بندی‌ها باید یکتا باشد.");
      return;
    }

    onSave({
      ...form,
      sku,
      slug,
      title: { fa: titleFa, en: form.title.en.trim() || titleFa },
      description: { fa: form.description.fa.trim(), en: form.description.en.trim() },
      price: { fa: Math.max(0, Number(form.price.fa) || 0), en: Math.max(0, Number(form.price.en) || 0) },
      compareAt: hasCompareAt
        ? { fa: Math.max(0, Number(form.compareAt?.fa) || 0), en: Math.max(0, Number(form.compareAt?.en) || 0) }
        : undefined,
      colors: form.colors.map((color) => ({ ...color, name: { fa: color.name.fa.trim(), en: color.name.en.trim() || color.name.fa.trim() }, hex: color.hex.toLowerCase(), stock: Number(color.stock) })),
      sizes: form.sizes.map((size) => ({ fa: size.fa.trim(), en: size.en.trim() })).filter((size) => size.fa || size.en),
      specs: form.specs.map((spec) => ({ label: { fa: spec.label.fa.trim(), en: spec.label.en.trim() }, value: { fa: spec.value.fa.trim(), en: spec.value.en.trim() } })).filter((spec) => spec.label.fa || spec.label.en || spec.value.fa || spec.value.en),
      materials: { fa: form.materials.fa.trim(), en: form.materials.en.trim() },
      familyId: form.familyId || null,
      order: Math.max(0, Math.floor(Number(form.order) || 0)),
    });
  };

  const addSize = () => set("sizes", [...form.sizes, { fa: "", en: "" }]);
  const addSpec = () => set("specs", [...form.specs, emptySpec()]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
      <button type="button" aria-label="بستن ویرایشگر محصول" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div><h2 id="product-editor-title" className="font-semibold">ویرایش محصول</h2><p className="mt-0.5 text-xs text-muted">اطلاعات، قیمت، واریانت‌ها، موجودی و مشخصات محصول را تنظیم کنید.</p></div>
          <button type="button" onClick={onClose} aria-label="بستن" className="rounded-md p-2 text-muted hover:bg-background-secondary"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">اطلاعات پایه</h3>
            <LocalizedFields label="عنوان" value={form.title} onChange={(title) => set("title", title)} />
            <LocalizedFields label="توضیحات" value={form.description} onChange={(description) => set("description", description)} textarea />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="SKU *"><Input dir="ltr" value={form.sku} onChange={(event) => set("sku", event.target.value)} /></Field>
              <Field label="اسلاگ *"><Input dir="ltr" value={form.slug} onChange={(event) => set("slug", event.target.value)} placeholder="از عنوان ساخته می‌شود" /></Field>
              <Field label="ترتیب"><Input dir="ltr" type="number" min="0" step="1" value={form.order} onChange={(event) => set("order", Number(event.target.value) || 0)} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="دسته‌بندی *"><Select value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)}><option value="">انتخاب کنید</option>{categories.map((category) => <option key={category.id} value={category.id}>{t(category.name, locale)}</option>)}</Select></Field>
              <Field label="خانوادهٔ محصول" hint="فهرست فعلی در کد سایت تعریف شده است؛ افزودن یا حذف خانواده از این فرم پشتیبانی نمی‌شود."><Select value={form.familyId ?? ""} onChange={(event) => set("familyId", event.target.value || null)}><option value="">بدون خانواده</option>{PRODUCT_FAMILIES.map((family) => <option key={family.id} value={family.id}>{family.name[locale]}</option>)}</Select></Field>
              <Field label="پترن مرتبط"><Select value={form.patternId ?? ""} onChange={(event) => set("patternId", event.target.value || null)}><option value="">بدون پترن</option>{patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{t(pattern.title, locale)}</option>)}</Select></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="هنرمند"><Select value={form.artistId ?? ""} onChange={(event) => set("artistId", event.target.value || null)}><option value="">آتلیه رزی</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{t(artist.name, locale)}</option>)}</Select></Field>
              <div className="flex flex-wrap items-center gap-4 pt-7 text-sm">
                {([["featured", "منتخب"], ["bestSeller", "پرفروش"], ["isNew", "جدید"]] as const).map(([key, label]) => <label key={key} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} className="accent-accent" />{label}</label>)}
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">قیمت و متریال</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="قیمت (تومان)"><Input dir="ltr" type="number" min="0" value={form.price.fa} onChange={(event) => set("price", { ...form.price, fa: Number(event.target.value) || 0 })} /></Field>
              <Field label="Price (USD)"><Input dir="ltr" type="number" min="0" value={form.price.en} onChange={(event) => set("price", { ...form.price, en: Number(event.target.value) || 0 })} /></Field>
            </div>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={hasCompareAt} onChange={(event) => setHasCompareAt(event.target.checked)} className="accent-accent" />ثبت قیمت قبل از تخفیف</label>
            {hasCompareAt && <div className="grid gap-3 sm:grid-cols-2"><Field label="قیمت قبل از تخفیف (تومان)"><Input dir="ltr" type="number" min="0" value={form.compareAt?.fa ?? 0} onChange={(event) => set("compareAt", { fa: Number(event.target.value) || 0, en: form.compareAt?.en ?? 0 })} /></Field><Field label="Was price (USD)"><Input dir="ltr" type="number" min="0" value={form.compareAt?.en ?? 0} onChange={(event) => set("compareAt", { fa: form.compareAt?.fa ?? 0, en: Number(event.target.value) || 0 })} /></Field></div>}
            <LocalizedFields label="متریال" value={form.materials} onChange={(materials) => set("materials", materials)} />
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">رنگ‌بندی و موجودی</h3><p className="mt-0.5 text-xs text-muted">هر واریانت تصویر، نام دو‌زبانه، رنگ و موجودی مستقل دارد.</p></div>{form.colors.length > 0 && <Badge tone="outline">{form.colors.length} واریانت</Badge>}</div>
            {form.colors.map((color, index) => (
              <div key={color.id} className="space-y-3 rounded-xl border border-border bg-background-secondary/40 p-3">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold">واریانت {index + 1} · <code dir="ltr">{color.id}</code></p><button type="button" onClick={() => set("colors", form.colors.filter((item) => item.id !== color.id))} aria-label="حذف واریانت" className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                <LocalizedFields label="نام رنگ‌بندی" value={color.name} onChange={(name) => updateColor(color.id, { name })} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="رنگ"><Input type="color" value={/^#[\da-f]{6}$/i.test(color.hex) ? color.hex : "#8fa08e"} onChange={(event) => updateColor(color.id, { hex: event.target.value })} /></Field>
                  <Field label="موجودی"><Input dir="ltr" type="number" min="0" step="1" value={Number.isFinite(color.stock) ? color.stock : ""} onChange={(event) => updateColor(color.id, { stock: Number(event.target.value) || 0 })} /></Field>
                  <Field label="تصویر واریانت *"><Input dir="ltr" value={color.image} onChange={(event) => updateColor(color.id, { image: event.target.value })} /></Field>
                </div>
                <MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => updateColor(color.id, { image })} />
              </div>
            ))}
            {form.colors.length === 0 && !firstVariantOpen && <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted">این محصول واریانت قابل خرید ندارد. برای افزودن واریانت، دکمهٔ زیر را بزنید؛ ذخیرهٔ بدون واریانت نیز فقط برای حفظ رکوردهای قدیمی مجاز است.</p>}
            {form.colors.length === 0 && firstVariantOpen && <FirstProductVariantFields value={firstVariant} onChange={(patch) => { setFirstVariant((current) => ({ ...current, ...patch })); setVariantError(null); }} error={variantError} />}
            <div className="flex flex-wrap gap-2">
              {form.colors.length > 0 ? <Button type="button" size="sm" variant="outline" onClick={() => set("colors", [...form.colors, emptyColor()])}><Plus className="h-4 w-4" />افزودن واریانت</Button> : <Button type="button" size="sm" variant="outline" onClick={() => firstVariantOpen ? addFirstVariant() : setFirstVariantOpen(true)}><Plus className="h-4 w-4" />{firstVariantOpen ? "ثبت واریانت اول" : "افزودن واریانت اول"}</Button>}
              {form.colors.length === 0 && firstVariantOpen && <Button type="button" size="sm" variant="ghost" onClick={() => { setFirstVariantOpen(false); setVariantError(null); }}>انصراف از واریانت</Button>}
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">اندازه‌ها</h3><p className="mt-0.5 text-xs text-muted">اندازه را جداگانه به فارسی و انگلیسی ثبت کنید.</p></div><Button type="button" size="sm" variant="outline" onClick={addSize}><Plus className="h-4 w-4" />افزودن اندازه</Button></div>
            {form.sizes.map((size, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Field label={`فارسی ${index + 1}`}><Input dir="rtl" value={size.fa} onChange={(event) => set("sizes", form.sizes.map((item, i) => i === index ? { ...item, fa: event.target.value } : item))} /></Field><Field label={`English ${index + 1}`}><Input dir="ltr" value={size.en} onChange={(event) => set("sizes", form.sizes.map((item, i) => i === index ? { ...item, en: event.target.value } : item))} /></Field><button type="button" onClick={() => set("sizes", form.sizes.filter((_, i) => i !== index))} aria-label="حذف اندازه" className="mt-6 rounded p-2 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">مشخصات</h3><p className="mt-0.5 text-xs text-muted">نام و مقدار هر مشخصه در دو زبان.</p></div><Button type="button" size="sm" variant="outline" onClick={addSpec}><Plus className="h-4 w-4" />افزودن مشخصه</Button></div>
            {form.specs.map((spec, index) => <div key={index} className="space-y-2 rounded-lg border border-border p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold">مشخصه {index + 1}</p><button type="button" onClick={() => set("specs", form.specs.filter((_, i) => i !== index))} aria-label="حذف مشخصه" className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div><LocalizedFields label="عنوان مشخصه" value={spec.label} onChange={(label) => set("specs", form.specs.map((item, i) => i === index ? { ...item, label } : item))} /><LocalizedFields label="مقدار مشخصه" value={spec.value} onChange={(value) => set("specs", form.specs.map((item, i) => i === index ? { ...item, value } : item))} /></div>)}
          </section>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-border bg-white px-4 py-3 sm:px-5"><Button type="button" size="sm" variant="outline" onClick={onClose}>انصراف</Button><Button type="button" size="sm" onClick={save}>ذخیرهٔ محصول</Button></footer>
      </section>
    </div>
  );
}
