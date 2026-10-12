"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { MediaUploadControl } from "@/components/admin/MediaUploadControl";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { slugify, t } from "@/lib/utils";
import { hasUniqueIds } from "@/lib/admin-editor-validation";
import type { Category, Colorway, Pattern, PatternSpec, Artist, Space } from "@/lib/types";
import type { Locale, Localized } from "@/lib/i18n/types";

type PatternEditorProps = {
  pattern: Pattern;
  isNew: boolean;
  patterns: Pattern[];
  categories: Category[];
  artists: Artist[];
  spaces: Space[];
  locale: Locale;
  onSave: (pattern: Pattern) => void;
  onClose: () => void;
};

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

function newColorway(): Colorway {
  return {
    id: `colorway-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: { fa: "", en: "" },
    hex: "#8fa08e",
    image: "",
    isDefault: false,
  };
}

export function PatternEditor({
  pattern,
  isNew,
  patterns,
  categories,
  artists,
  spaces,
  locale,
  onSave,
  onClose,
}: PatternEditorProps) {
  const [form, setForm] = useState<Pattern>(() => ({
    ...pattern,
    title: { fa: pattern.title?.fa ?? "", en: pattern.title?.en ?? "" },
    description: { fa: pattern.description?.fa ?? "", en: pattern.description?.en ?? "" },
    gallery: [...(pattern.gallery ?? [])],
    spaceIds: [...(pattern.spaceIds ?? [])],
    price: { fa: pattern.price?.fa ?? 0, en: pattern.price?.en ?? 0 },
    specs: {
      repeat: { fa: pattern.specs?.repeat?.fa ?? "", en: pattern.specs?.repeat?.en ?? "" },
      dpi: pattern.specs?.dpi ?? "",
      formats: pattern.specs?.formats ?? "",
      colors: Number.isSafeInteger(pattern.specs?.colors) ? pattern.specs.colors : 0,
      scale: { fa: pattern.specs?.scale?.fa ?? "", en: pattern.specs?.scale?.en ?? "" },
    },
    palette: [...(pattern.palette ?? [])],
    colorways: pattern.colorways?.map((colorway) => ({
      ...colorway,
      name: { fa: colorway.name?.fa ?? "", en: colorway.name?.en ?? "" },
      gallery: colorway.gallery ? [...colorway.gallery] : undefined,
    })),
    tags: [...(pattern.tags ?? [])],
    createdAt: pattern.createdAt ?? new Date().toISOString().slice(0, 10),
    likes: Number.isSafeInteger(pattern.likes) ? pattern.likes : 0,
  }));
  const [galleryInput, setGalleryInput] = useState((pattern.gallery ?? []).join("\n"));
  const [paletteInput, setPaletteInput] = useState((pattern.palette ?? []).join("\n"));
  const [tagsInput, setTagsInput] = useState((pattern.tags ?? []).join("\n"));
  const [colorwayGalleryInputs, setColorwayGalleryInputs] = useState<Record<string, string>>(
    Object.fromEntries((pattern.colorways ?? []).map((colorway) => [colorway.id, (colorway.gallery ?? []).join("\n")])),
  );
  const [error, setError] = useState("");

  const set = <K extends keyof Pattern>(key: K, value: Pattern[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setSpec = <K extends keyof PatternSpec>(key: K, value: PatternSpec[K]) => setForm((current) => ({ ...current, specs: { ...current.specs, [key]: value } }));

  const save = () => {
    const titleFa = form.title.fa.trim();
    const sku = form.sku.trim();
    const slug = slugify(form.slug.trim() || form.title.en || titleFa);
    if (!titleFa || !sku || !slug) {
      setError("عنوان فارسی، SKU و اسلاگ معتبر را وارد کنید.");
      return;
    }
    if (!categories.some((category) => category.id === form.categoryId)) {
      setError("برای پترن یک دسته‌بندی معتبر انتخاب کنید.");
      return;
    }
    if (form.artistId && !artists.some((artist) => artist.id === form.artistId)) {
      setError("هنرمند انتخاب‌شده در سایت موجود نیست.");
      return;
    }
    if (form.spaceIds.some((spaceId) => !spaces.some((space) => space.id === spaceId))) {
      setError("یک یا چند فضای مرتبط حذف شده‌اند؛ ارجاع قدیمی را از فهرست فضاها پاک کنید.");
      return;
    }
    if (patterns.some((item) => item.id !== form.id && item.sku.trim().toLowerCase() === sku.toLowerCase())) {
      setError("این SKU قبلاً استفاده شده است.");
      return;
    }
    if (patterns.some((item) => item.id !== form.id && slugify(item.slug) === slug)) {
      setError("این اسلاگ قبلاً برای پترن دیگری استفاده شده است.");
      return;
    }
    if (!form.image.trim()) {
      setError("تصویر اصلی پترن را وارد یا آپلود کنید.");
      return;
    }
    if (!Number.isSafeInteger(Number(form.specs.colors)) || Number(form.specs.colors) < 0) {
      setError("تعداد رنگ‌ها باید عدد صحیح صفر یا بیشتر باشد.");
      return;
    }
    const colorways = form.colorways ?? [];
    if (colorways.some((colorway) =>
      !colorway.id.trim() || !colorway.name.fa.trim()
      || !/^#[\da-f]{6}$/i.test(colorway.hex) || !colorway.image.trim(),
    )) {
      setError("هر رنگ‌بندی باید شناسه، نام فارسی، کد رنگ و تصویر داشته باشد؛ نام انگلیسی خالی از فارسی تکمیل می‌شود.");
      return;
    }
    if (!hasUniqueIds(colorways)) {
      setError("شناسهٔ رنگ‌بندی‌ها باید یکتا باشد.");
      return;
    }

    const normalizedColorways = colorways.map((colorway, index) => ({
      ...colorway,
      name: { fa: colorway.name.fa.trim(), en: colorway.name.en.trim() || colorway.name.fa.trim() },
      hex: colorway.hex.toLowerCase(),
      gallery: (colorwayGalleryInputs[colorway.id] ?? colorway.gallery?.join("\n") ?? "").split("\n").map((image) => image.trim()).filter(Boolean),
      isDefault: colorways.some((item) => item.isDefault) ? colorway.isDefault : index === 0,
    }));
    if (normalizedColorways.some((colorway) => colorway.isDefault)) {
      let defaultAssigned = false;
      for (const colorway of normalizedColorways) {
        if (!colorway.isDefault) continue;
        if (defaultAssigned) colorway.isDefault = false;
        else defaultAssigned = true;
      }
    }

    onSave({
      ...form,
      sku,
      slug,
      title: { fa: titleFa, en: form.title.en.trim() || titleFa },
      description: { fa: form.description.fa.trim(), en: form.description.en.trim() },
      image: form.image.trim(),
      gallery: galleryInput.split("\n").map((value) => value.trim()).filter(Boolean),
      palette: paletteInput.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean),
      tags: tagsInput.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean),
      colorways: normalizedColorways.length ? normalizedColorways : undefined,
      price: { fa: Math.max(0, Number(form.price.fa) || 0), en: Math.max(0, Number(form.price.en) || 0) },
      specs: { ...form.specs, colors: Number(form.specs.colors) || 0 },
      createdAt: form.createdAt || new Date().toISOString().slice(0, 10),
      likes: Math.max(0, Math.floor(Number(form.likes) || 0)),
    });
  };

  const toggleSpace = (spaceId: string) => {
    const selected = new Set(form.spaceIds);
    if (selected.has(spaceId)) selected.delete(spaceId);
    else selected.add(spaceId);
    set("spaceIds", [...selected]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="pattern-editor-title">
      <button type="button" aria-label="بستن ویرایشگر پترن" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="pattern-editor-title" className="font-semibold">{isNew ? "افزودن پترن" : "ویرایش پترن"}</h2>
            <p className="mt-0.5 text-xs text-muted">فیلدهای اصلی، رسانه، مشخصات، رنگ‌بندی و ارتباط‌های این پترن را ویرایش کنید.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="rounded-md p-2 text-muted hover:bg-background-secondary"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">اطلاعات اصلی</h3>
            <LocalizedFields label="عنوان" value={form.title} onChange={(title) => set("title", title)} />
            <LocalizedFields label="توضیحات" value={form.description} onChange={(description) => set("description", description)} textarea />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="SKU *"><Input dir="ltr" value={form.sku} onChange={(event) => set("sku", event.target.value)} maxLength={80} /></Field>
              <Field label="اسلاگ *" hint="در صورت خالی بودن از عنوان ساخته می‌شود."><Input dir="ltr" value={form.slug} onChange={(event) => set("slug", event.target.value)} maxLength={120} /></Field>
              <Field label="تاریخ ایجاد"><Input dir="ltr" type="date" value={form.createdAt.slice(0, 10)} onChange={(event) => set("createdAt", event.target.value)} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="دسته‌بندی *">
                <Select value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
                  <option value="">انتخاب کنید</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{t(category.name, locale)}</option>)}
                </Select>
              </Field>
              <Field label="طراح">
                <Select value={form.artistId ?? ""} onChange={(event) => set("artistId", event.target.value || null)}>
                  <option value="">آتلیه رزی</option>
                  {artists.map((artist) => <option key={artist.id} value={artist.id}>{t(artist.name, locale)}</option>)}
                </Select>
              </Field>
              <Field label="قیمت فارسی (تومان)"><Input dir="ltr" type="number" min="0" value={form.price.fa} onChange={(event) => set("price", { ...form.price, fa: Number(event.target.value) || 0 })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="قیمت انگلیسی (دلار)"><Input dir="ltr" type="number" min="0" value={form.price.en} onChange={(event) => set("price", { ...form.price, en: Number(event.target.value) || 0 })} /></Field>
              <Field label="تعداد لایک"><Input dir="ltr" type="number" min="0" step="1" value={form.likes} onChange={(event) => set("likes", Number(event.target.value) || 0)} /></Field>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-6 text-sm">
                {([["featured", "منتخب"], ["trending", "پرطرفدار"], ["bestSeller", "پرفروش"], ["isNew", "جدید"]] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5"><input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} className="accent-accent" />{label}</label>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">رسانه و پالت</h3>
            <Field label="تصویر اصلی *"><Input dir="ltr" value={form.image} onChange={(event) => set("image", event.target.value)} placeholder="/images/patterns/…" /></Field>
            <MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => set("image", image)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="گالری (هر آدرس در یک خط)">
                <Textarea dir="ltr" rows={4} value={galleryInput} onChange={(event) => setGalleryInput(event.target.value)} placeholder="/images/patterns/detail-1.jpg" />
                <div className="mt-2"><MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => setGalleryInput((current) => [...current.split("\n").filter(Boolean), image].join("\n"))} /></div>
              </Field>
              <Field label="رنگ‌های پالت (هر کد در یک خط)">
                <Textarea dir="ltr" rows={4} value={paletteInput} onChange={(event) => setPaletteInput(event.target.value)} placeholder="#8fa08e\n#efe9dd" />
                <div className="mt-2 flex flex-wrap gap-1.5">{paletteInput.split(/[\n,]+/).map((color) => color.trim()).filter((color) => /^#[\da-f]{6}$/i.test(color)).map((color, index) => <span key={`${color}-${index}`} title={color} className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: color }} />)}</div>
              </Field>
            </div>
            <Field label="تگ‌ها (هر تگ در یک خط یا با ویرگول)"><Textarea dir="ltr" rows={2} value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="botanical, calm" /></Field>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">مشخصات طرح</h3></div>
            <LocalizedFields label="تکرار طرح" value={form.specs.repeat} onChange={(repeat) => setSpec("repeat", repeat)} />
            <LocalizedFields label="مقیاس" value={form.specs.scale} onChange={(scale) => setSpec("scale", scale)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="DPI"><Input dir="ltr" value={form.specs.dpi} onChange={(event) => setSpec("dpi", event.target.value)} /></Field>
              <Field label="فرمت فایل‌ها"><Input dir="ltr" value={form.specs.formats} onChange={(event) => setSpec("formats", event.target.value)} /></Field>
              <Field label="تعداد رنگ‌ها"><Input dir="ltr" type="number" min="0" step="1" value={form.specs.colors} onChange={(event) => setSpec("colors", Number(event.target.value) || 0)} /></Field>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold">رنگ‌بندی‌ها</h3><p className="mt-0.5 text-xs text-muted">برای هر رنگ‌بندی عنوان، نمونه‌رنگ و تصویر مستقل ثبت کنید.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => { const colorway = newColorway(); set("colorways", [...(form.colorways ?? []), colorway]); setColorwayGalleryInputs((current) => ({ ...current, [colorway.id]: "" })); }}><Plus className="h-4 w-4" />افزودن رنگ‌بندی</Button>
            </div>
            {(form.colorways ?? []).length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted">رنگ‌بندی جداگانه‌ای ثبت نشده است؛ در صورت نیاز از دکمهٔ بالا اضافه کنید.</p> : (
              <div className="space-y-3">
                {(form.colorways ?? []).map((colorway, index) => (
                  <div key={colorway.id} className="space-y-3 rounded-xl border border-border bg-background-secondary/40 p-3">
                    <div className="flex items-center justify-between"><p className="text-xs font-semibold">رنگ‌بندی {index + 1}</p><button type="button" onClick={() => { set("colorways", (form.colorways ?? []).filter((item) => item.id !== colorway.id)); setColorwayGalleryInputs((current) => { const next = { ...current }; delete next[colorway.id]; return next; }); }} aria-label="حذف رنگ‌بندی" className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                    <LocalizedFields label="نام رنگ‌بندی" value={colorway.name} onChange={(name) => set("colorways", (form.colorways ?? []).map((item) => item.id === colorway.id ? { ...item, name } : item))} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="کد رنگ"><Input type="color" value={/^#[\da-f]{6}$/i.test(colorway.hex) ? colorway.hex : "#8fa08e"} onChange={(event) => set("colorways", (form.colorways ?? []).map((item) => item.id === colorway.id ? { ...item, hex: event.target.value } : item))} /></Field>
                      <Field label="تصویر *"><Input dir="ltr" value={colorway.image} onChange={(event) => set("colorways", (form.colorways ?? []).map((item) => item.id === colorway.id ? { ...item, image: event.target.value } : item))} /></Field>
                    </div>
                    <MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => set("colorways", (form.colorways ?? []).map((item) => item.id === colorway.id ? { ...item, image } : item))} />
                    <Field label="گالری این رنگ‌بندی (هر آدرس در یک خط)"><Textarea dir="ltr" rows={2} value={colorwayGalleryInputs[colorway.id] ?? (colorway.gallery ?? []).join("\n")} onChange={(event) => setColorwayGalleryInputs((current) => ({ ...current, [colorway.id]: event.target.value }))} /><div className="mt-2"><MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => setColorwayGalleryInputs((current) => ({ ...current, [colorway.id]: [...(current[colorway.id] ?? "").split("\n").filter(Boolean), image].join("\n") }))} /></div></Field>
                    <label className="inline-flex items-center gap-2 text-xs"><input type="radio" name={`default-colorway-${form.id}`} checked={Boolean(colorway.isDefault)} onChange={() => set("colorways", (form.colorways ?? []).map((item) => ({ ...item, isDefault: item.id === colorway.id })))} className="accent-accent" />رنگ‌بندی پیش‌فرض</label>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">ارتباط‌ها و فضاها</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="فضاهای مرتبط">
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {spaces.map((space) => <label key={space.id} className="flex items-center gap-2 rounded p-1.5 text-xs hover:bg-background-secondary"><input type="checkbox" checked={form.spaceIds.includes(space.id)} onChange={() => toggleSpace(space.id)} className="accent-accent" />{t(space.name, locale)}</label>)}
                  {spaces.length === 0 && <p className="p-2 text-xs text-muted">فضایی ثبت نشده است.</p>}
                </div>
                {form.spaceIds.filter((spaceId) => !spaces.some((space) => space.id === spaceId)).map((spaceId) => <div key={spaceId} className="mt-1 flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800"><span>فضای حذف‌شده: <code dir="ltr">{spaceId}</code></span><button type="button" onClick={() => set("spaceIds", form.spaceIds.filter((id) => id !== spaceId))} className="font-semibold hover:underline">حذف ارجاع</button></div>)}
              </Field>
              <p className="self-end text-xs leading-5 text-muted">دسته، طراح و فضاهای انتخاب‌شده روی فیلترها و صفحهٔ جزئیات سایت اثر می‌گذارند.</p>
            </div>
          </section>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border bg-white px-4 py-3 sm:px-5">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>انصراف</Button>
          <Button type="button" size="sm" onClick={save}>{isNew ? "افزودن پترن" : "ذخیره پترن"}</Button>
        </footer>
      </section>
    </div>
  );
}
