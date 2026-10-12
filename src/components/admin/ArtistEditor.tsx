"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { MediaUploadControl } from "@/components/admin/MediaUploadControl";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { slugify } from "@/lib/utils";
import { validateArtistServices } from "@/lib/admin-editor-validation";
import type { Artist, ArtistServiceItem } from "@/lib/types";
import type { Locale, Localized } from "@/lib/i18n/types";

const SERVICE_CATEGORIES: { id: ArtistServiceItem["category"]; label: string }[] = [
  { id: "patina", label: "پتینه و پوشش دیوار" },
  { id: "custom_pattern", label: "طراحی پترن سفارشی" },
  { id: "canvas_art", label: "تابلو و آثار بوم" },
  { id: "interior_consulting", label: "مشاورهٔ داخلی" },
  { id: "sculpture_craft", label: "مجسمه و صنایع‌دستی" },
  { id: "other", label: "سایر" },
];

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

function createService(): ArtistServiceItem {
  const id = `service-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  return {
    id,
    title: { fa: "", en: "" },
    category: "other",
    description: { fa: "", en: "" },
    price: { fa: 0, en: 0 },
    priceUnit: { fa: "", en: "" },
    deliveryTime: { fa: "", en: "" },
    image: "",
    gallery: [],
    featured: false,
    active: true,
  };
}

export function ArtistEditor({
  artist,
  artists,
  locale,
  onSave,
  onClose,
}: {
  artist: Artist;
  artists: Artist[];
  locale: Locale;
  onSave: (artist: Artist) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Artist>(() => ({
    ...artist,
    name: { ...artist.name },
    profession: { ...artist.profession },
    bio: { ...artist.bio },
    location: { ...artist.location },
    social: { ...artist.social },
    tags: [...(artist.tags ?? [])],
    licenseNote: artist.licenseNote ? { ...artist.licenseNote } : { fa: "", en: "" },
    commissionNotice: artist.commissionNotice ? { ...artist.commissionNotice } : { fa: "", en: "" },
    services: artist.services?.map((service) => ({
      ...service,
      title: { ...service.title },
      categoryLabel: service.categoryLabel ? { ...service.categoryLabel } : undefined,
      description: { ...service.description },
      price: { ...service.price },
      priceUnit: service.priceUnit ? { ...service.priceUnit } : undefined,
      deliveryTime: service.deliveryTime ? { ...service.deliveryTime } : undefined,
      gallery: service.gallery ? [...service.gallery] : [],
    })) ?? [],
  }));
  const [tagsInput, setTagsInput] = useState((artist.tags ?? []).join("\n"));
  const [serviceGalleryInput, setServiceGalleryInput] = useState<Record<string, string>>(
    Object.fromEntries((artist.services ?? []).map((service) => [service.id, (service.gallery ?? []).join("\n")])),
  );
  const [error, setError] = useState("");

  const set = <K extends keyof Artist>(key: K, value: Artist[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateService = (serviceId: string, patch: Partial<ArtistServiceItem>) => {
    set("services", (form.services ?? []).map((service) => service.id === serviceId ? { ...service, ...patch } : service));
  };

  const save = () => {
    const nameFa = form.name.fa.trim();
    const slug = slugify(form.slug.trim() || form.name.en || nameFa);
    const share = form.revenueSharePct;
    if (!nameFa || !slug) {
      setError("نام فارسی و اسلاگ معتبر را وارد کنید.");
      return;
    }
    if (artists.some((item) => item.id !== form.id && slugify(item.slug) === slug)) {
      setError("این اسلاگ برای هنرمند دیگری استفاده شده است.");
      return;
    }
    if (!Number.isFinite(form.rating) || form.rating < 0 || form.rating > 5) {
      setError("امتیاز باید عددی بین صفر تا پنج باشد.");
      return;
    }
    if (!Number.isSafeInteger(Number(form.followers)) || form.followers < 0 || !Number.isSafeInteger(Number(form.reviewsCount)) || form.reviewsCount < 0) {
      setError("تعداد دنبال‌کنندگان و نظرها باید عدد صحیح صفر یا بیشتر باشد.");
      return;
    }
    if (share !== undefined && (!Number.isFinite(share) || share < 0 || share > 100)) {
      setError("سهم هنرمند باید بین صفر تا صد درصد باشد.");
      return;
    }
    const services = form.services ?? [];
    const serviceValidationError = validateArtistServices(services);
    if (serviceValidationError === "duplicate-id") {
      setError("شناسهٔ خدمات باید یکتا و غیرخالی باشد.");
      return;
    }
    if (serviceValidationError === "incomplete-active-service") {
      setError("هر خدمت فعال‌شده باید عنوان، توضیحات فارسی و قیمت معتبر داشته باشد.");
      return;
    }

    onSave({
      ...form,
      slug,
      name: { fa: nameFa, en: form.name.en.trim() || nameFa },
      profession: { fa: form.profession.fa.trim(), en: form.profession.en.trim() },
      bio: { fa: form.bio.fa.trim(), en: form.bio.en.trim() },
      location: { fa: form.location.fa.trim(), en: form.location.en.trim() },
      social: {
        instagram: form.social.instagram?.trim() || undefined,
        behance: form.social.behance?.trim() || undefined,
        website: form.social.website?.trim() || undefined,
      },
      tags: tagsInput.split(/[\n,]+/).map((tag) => tag.trim()).filter(Boolean),
      followers: Math.floor(form.followers),
      reviewsCount: Math.floor(form.reviewsCount),
      rating: Number(form.rating),
      revenueSharePct: share === undefined || Number.isNaN(Number(share)) ? undefined : Number(share),
      licenseNote: form.licenseNote && (form.licenseNote.fa.trim() || form.licenseNote.en.trim())
        ? { fa: form.licenseNote.fa.trim(), en: form.licenseNote.en.trim() }
        : undefined,
      commissionNotice: form.commissionNotice && (form.commissionNotice.fa.trim() || form.commissionNotice.en.trim())
        ? { fa: form.commissionNotice.fa.trim(), en: form.commissionNotice.en.trim() }
        : undefined,
      services: services.map((service) => ({
        ...service,
        title: { fa: service.title.fa.trim(), en: service.title.en.trim() || service.title.fa.trim() },
        categoryLabel: service.categoryLabel && (service.categoryLabel.fa.trim() || service.categoryLabel.en.trim())
          ? { fa: service.categoryLabel.fa.trim(), en: service.categoryLabel.en.trim() || service.categoryLabel.fa.trim() }
          : undefined,
        description: { fa: service.description.fa.trim(), en: service.description.en.trim() || service.description.fa.trim() },
        price: { fa: Math.max(0, Number(service.price.fa) || 0), en: Math.max(0, Number(service.price.en) || 0) },
        priceUnit: service.priceUnit && (service.priceUnit.fa.trim() || service.priceUnit.en.trim()) ? { fa: service.priceUnit.fa.trim(), en: service.priceUnit.en.trim() } : undefined,
        deliveryTime: service.deliveryTime && (service.deliveryTime.fa.trim() || service.deliveryTime.en.trim()) ? { fa: service.deliveryTime.fa.trim(), en: service.deliveryTime.en.trim() } : undefined,
        gallery: (serviceGalleryInput[service.id] ?? service.gallery?.join("\n") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      })),
    });
  };

  const addService = () => {
    const service = createService();
    set("services", [...(form.services ?? []), service]);
    setServiceGalleryInput((current) => ({ ...current, [service.id]: "" }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="artist-editor-title">
      <button type="button" aria-label="بستن ویرایشگر پروفایل هنرمند" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div><h2 id="artist-editor-title" className="font-semibold">ویرایش پروفایل هنرمند</h2><p className="mt-0.5 text-xs text-muted">اطلاعات عمومی و خدمات هنرمند قابل ویرایش است؛ داده‌های ثبت‌نام و درخواست‌های مشتری دست‌نخورده می‌مانند.</p></div>
          <button type="button" onClick={onClose} aria-label="بستن" className="rounded-md p-2 text-muted hover:bg-background-secondary"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">هویت و معرفی</h3>
            <LocalizedFields label="نام" value={form.name} onChange={(name) => set("name", name)} />
            <LocalizedFields label="عنوان شغلی" value={form.profession} onChange={(profession) => set("profession", profession)} />
            <LocalizedFields label="زندگی‌نامه" value={form.bio} onChange={(bio) => set("bio", bio)} textarea />
            <Field label="اسلاگ پروفایل"><Input dir="ltr" value={form.slug} onChange={(event) => set("slug", event.target.value)} /></Field>
            <LocalizedFields label="موقعیت" value={form.location} onChange={(location) => set("location", location)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Field label="تصویر پروفایل"><Input dir="ltr" value={form.avatar} onChange={(event) => set("avatar", event.target.value)} /></Field><MediaUploadControl mediaType="image" locale={locale} onUploaded={(avatar) => set("avatar", avatar)} /></div>
              <div className="space-y-2"><Field label="تصویر کاور"><Input dir="ltr" value={form.cover} onChange={(event) => set("cover", event.target.value)} /></Field><MediaUploadControl mediaType="image" locale={locale} onUploaded={(cover) => set("cover", cover)} /></div>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">لینک‌ها، تگ‌ها و آمار عمومی</h3>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Instagram"><Input dir="ltr" value={form.social.instagram ?? ""} onChange={(event) => set("social", { ...form.social, instagram: event.target.value })} /></Field><Field label="Behance"><Input dir="ltr" value={form.social.behance ?? ""} onChange={(event) => set("social", { ...form.social, behance: event.target.value })} /></Field><Field label="وب‌سایت"><Input dir="ltr" type="url" value={form.social.website ?? ""} onChange={(event) => set("social", { ...form.social, website: event.target.value })} /></Field></div>
            <Field label="تگ‌ها (هر تگ در یک خط یا با ویرگول)"><Textarea dir="ltr" rows={2} value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="botanical, surface design" /></Field>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="دنبال‌کنندگان"><Input dir="ltr" type="number" min="0" step="1" value={form.followers} onChange={(event) => set("followers", Number(event.target.value) || 0)} /></Field><Field label="امتیاز (۰–۵)"><Input dir="ltr" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => set("rating", Number(event.target.value) || 0)} /></Field><Field label="تعداد نظرها"><Input dir="ltr" type="number" min="0" step="1" value={form.reviewsCount} onChange={(event) => set("reviewsCount", Number(event.target.value) || 0)} /></Field></div>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">کمیسیون و مجوز</h3>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="سهم درآمد هنرمند (٪)" hint="خالی = استفاده از سهم پیش‌فرض مالی سایت."><Input dir="ltr" type="number" min="0" max="100" value={form.revenueSharePct ?? ""} onChange={(event) => set("revenueSharePct", event.target.value === "" ? undefined : Number(event.target.value))} /></Field><Field label="نوع مجوز"><Select value={form.licenseType ?? "standard"} onChange={(event) => set("licenseType", event.target.value as Artist["licenseType"])}><option value="standard">استاندارد</option><option value="exclusive">انحصاری</option><option value="custom">سفارشی</option></Select></Field></div>
            <LocalizedFields label="توضیح مجوز" value={form.licenseNote ?? { fa: "", en: "" }} onChange={(licenseNote) => set("licenseNote", licenseNote)} textarea />
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">سفارش سفارشی و خدمات</h3><p className="mt-0.5 text-xs text-muted">خدمات غیرفعال‌شده برای مشتری نمایش داده نمی‌شوند.</p></div><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.acceptsCommissions ?? false} onChange={(event) => set("acceptsCommissions", event.target.checked)} className="accent-accent" />پذیرش سفارش جدید</label></div>
            <LocalizedFields label="پیام سفارش" value={form.commissionNotice ?? { fa: "", en: "" }} onChange={(commissionNotice) => set("commissionNotice", commissionNotice)} textarea />
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">خدمات</p><Button type="button" size="sm" variant="outline" onClick={addService}><Plus className="h-4 w-4" />افزودن خدمت</Button></div>
            {(form.services ?? []).length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted">خدمتی ثبت نشده است.</p>}
            {(form.services ?? []).map((service, index) => (
              <div key={service.id} className="space-y-3 rounded-xl border border-border bg-background-secondary/40 p-3">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">خدمت {index + 1}</p><button type="button" onClick={() => set("services", (form.services ?? []).filter((item) => item.id !== service.id))} aria-label="حذف خدمت" className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                <LocalizedFields label="عنوان خدمت" value={service.title} onChange={(title) => updateService(service.id, { title })} />
                <Field label="دستهٔ خدمت"><Select value={service.category} onChange={(event) => updateService(service.id, { category: event.target.value as ArtistServiceItem["category"] })}>{SERVICE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</Select></Field>
                <LocalizedFields label="برچسب دستهٔ اختصاصی (اختیاری)" value={service.categoryLabel ?? { fa: "", en: "" }} onChange={(categoryLabel) => updateService(service.id, { categoryLabel })} />
                <LocalizedFields label="توضیحات خدمت" value={service.description} onChange={(description) => updateService(service.id, { description })} textarea />
                <div className="grid gap-3 sm:grid-cols-2"><Field label="قیمت (تومان)"><Input dir="ltr" type="number" min="0" value={service.price.fa} onChange={(event) => updateService(service.id, { price: { ...service.price, fa: Number(event.target.value) || 0 } })} /></Field><Field label="Price (USD)"><Input dir="ltr" type="number" min="0" value={service.price.en} onChange={(event) => updateService(service.id, { price: { ...service.price, en: Number(event.target.value) || 0 } })} /></Field></div>
                <LocalizedFields label="واحد قیمت" value={service.priceUnit ?? { fa: "", en: "" }} onChange={(priceUnit) => updateService(service.id, { priceUnit })} />
                <LocalizedFields label="زمان تحویل" value={service.deliveryTime ?? { fa: "", en: "" }} onChange={(deliveryTime) => updateService(service.id, { deliveryTime })} />
                <Field label="تصویر خدمت"><Input dir="ltr" value={service.image} onChange={(event) => updateService(service.id, { image: event.target.value })} /></Field>
                <MediaUploadControl mediaType="image" locale={locale} onUploaded={(image) => updateService(service.id, { image })} />
                <Field label="گالری خدمت (هر نشانی در یک خط)"><Textarea dir="ltr" rows={2} value={serviceGalleryInput[service.id] ?? (service.gallery ?? []).join("\n")} onChange={(event) => setServiceGalleryInput((current) => ({ ...current, [service.id]: event.target.value }))} /></Field>
                <div className="flex flex-wrap gap-4 text-xs"><label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={Boolean(service.active)} onChange={(event) => updateService(service.id, { active: event.target.checked })} className="accent-accent" />فعال و قابل نمایش</label><label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={Boolean(service.featured)} onChange={(event) => updateService(service.id, { featured: event.target.checked })} className="accent-accent" />خدمت منتخب</label></div>
              </div>
            ))}
          </section>

          <p className="rounded-lg bg-background-secondary p-3 text-xs leading-5 text-muted">اطلاعات ثبت‌نام، شناسهٔ حساب، وضعیت تأیید، اشتراک و پیام‌های مشتری در این فرم تغییر نمی‌کنند.</p>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-border bg-white px-4 py-3 sm:px-5"><Button type="button" size="sm" variant="outline" onClick={onClose}>انصراف</Button><Button type="button" size="sm" onClick={save}>ذخیرهٔ پروفایل</Button></footer>
      </section>
    </div>
  );
}
