"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Layers3, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { MediaUploadControl } from "@/components/admin/MediaUploadControl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { getCollectionReferenceIssues } from "@/lib/collection-references";
import { slugify, t, href } from "@/lib/utils";
import type { Locale, Localized } from "@/lib/i18n/types";
import type { Collection, Pattern, Product, SiteContent } from "@/lib/types";

type CollectionEditorTarget = Collection | null;

type ReferenceOption = { id: string; label: string; image?: string };

function makeId() {
  return `collection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function newCollection(): Collection {
  return {
    id: makeId(),
    slug: "",
    title: { fa: "مجموعه جدید", en: "New collection" },
    description: { fa: "", en: "" },
    cover: "/images/collections/s01.jpg",
    patternIds: [],
    productIds: [],
  };
}

function makeEditableCollection(collection: Collection): Collection {
  return {
    ...collection,
    title: { ...collection.title },
    description: { ...collection.description },
    patternIds: [...(collection.patternIds ?? [])],
    productIds: [...(collection.productIds ?? [])],
  };
}

function ReferencePicker({
  label,
  items,
  selectedIds,
  onChange,
}: {
  label: string;
  items: ReferenceOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(selectedIds);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = items.filter((item) =>
    !normalizedQuery
      || item.label.toLocaleLowerCase().includes(normalizedQuery)
      || item.id.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <fieldset className="min-w-0 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {label} <span className="text-xs font-normal text-muted">({selectedIds.length} انتخاب‌شده)</span>
      </legend>
      <label className="relative mb-2 block">
        <span className="sr-only">جستجو در {label}</span>
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجو بر اساس عنوان یا شناسه"
          className="pr-9"
        />
      </label>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-background-secondary/50 p-2">
        {visible.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-muted">
            {items.length === 0 ? "هنوز موردی در کاتالوگ نیست." : "موردی با این جستجو پیدا نشد."}
          </p>
        ) : visible.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-white"
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={(event) => {
                onChange(event.target.checked
                  ? [...selectedIds, item.id]
                  : selectedIds.filter((id) => id !== item.id));
              }}
              className="h-4 w-4 shrink-0 accent-accent"
            />
            {item.image ? (
              <span className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt="" className="h-full w-full object-cover" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <code dir="ltr" className="max-w-28 truncate text-[10px] text-muted">{item.id}</code>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CollectionEditor({
  initialCollection,
  isNew,
  collections,
  data,
  locale,
  onSave,
  onCancel,
}: {
  initialCollection: Collection;
  isNew: boolean;
  collections: Collection[];
  data: SiteContent;
  locale: Locale;
  onSave: (collection: Collection) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => makeEditableCollection(initialCollection));
  const [error, setError] = useState("");
  const patternIdSet = useMemo(() => new Set(data.patterns.map((pattern) => pattern.id)), [data.patterns]);
  const productIdSet = useMemo(() => new Set(data.products.map((product) => product.id)), [data.products]);
  const issues = getCollectionReferenceIssues(draft, data.patterns, data.products);

  const patterns: ReferenceOption[] = data.patterns.map((pattern: Pattern) => ({
    id: pattern.id,
    label: `${t(pattern.title, locale)} · ${pattern.sku}`,
    image: pattern.image,
  }));
  const products: ReferenceOption[] = data.products.map((product: Product) => ({
    id: product.id,
    label: `${t(product.title, locale)} · ${product.sku}`,
    image: product.colors?.[0]?.image,
  }));

  const setLocalized = (field: "title" | "description", language: keyof Localized, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: { ...current[field], [language]: value },
    }));
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const faTitle = draft.title.fa.trim();
    if (!faTitle) {
      setError("عنوان فارسی مجموعه را وارد کنید.");
      return;
    }

    const slug = slugify(draft.slug.trim() || draft.title.en || faTitle);
    if (!slug) {
      setError("برای مجموعه یک اسلاگ معتبر وارد کنید.");
      return;
    }
    if (collections.some((item) => item.id !== draft.id && slugify(item.slug) === slug)) {
      setError("این اسلاگ قبلاً برای مجموعهٔ دیگری استفاده شده است.");
      return;
    }
    if (isNew && collections.some((item) => item.id === draft.id)) {
      setError("شناسهٔ این مجموعه تکراری است؛ فرم را ببندید و دوباره بسازید.");
      return;
    }
    if (issues.missingPatternIds.length || issues.missingProductIds.length) {
      setError("ارجاع‌های ناموجود را از فهرست پاک کنید تا مجموعه فقط به پترن‌ها و محصولات موجود وصل باشد.");
      return;
    }

    onSave({
      ...draft,
      slug,
      title: { fa: faTitle, en: draft.title.en.trim() || faTitle },
      description: { fa: draft.description.fa.trim(), en: draft.description.en.trim() },
      cover: draft.cover.trim() || "/images/collections/s01.jpg",
      patternIds: [...new Set(draft.patternIds)],
      productIds: [...new Set(draft.productIds)],
    });
  };

  const selectedPatternIds = draft.patternIds.filter((id) => patternIdSet.has(id));
  const selectedProductIds = draft.productIds.filter((id) => productIdSet.has(id));

  return (
    <section className="overflow-hidden rounded-xl border border-accent/30 bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background-secondary/40 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{isNew ? "ساخت مجموعهٔ جدید" : "ویرایش مجموعه"}</h2>
          <p className="mt-0.5 text-xs text-muted">اطلاعات و محصولات مرتبط بعد از ذخیرهٔ پنل در سایت نمایش داده می‌شوند.</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="بستن فرم مجموعه" className="rounded-md p-2 text-muted hover:bg-white hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={save} className="space-y-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="عنوان فارسی *">
            <Input dir="rtl" value={draft.title.fa} onChange={(event) => setLocalized("title", "fa", event.target.value)} maxLength={120} />
          </Field>
          <Field label="عنوان انگلیسی">
            <Input dir="ltr" value={draft.title.en} onChange={(event) => setLocalized("title", "en", event.target.value)} maxLength={120} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="توضیحات فارسی">
            <Textarea dir="rtl" value={draft.description.fa} onChange={(event) => setLocalized("description", "fa", event.target.value)} maxLength={1000} />
          </Field>
          <Field label="توضیحات انگلیسی">
            <Textarea dir="ltr" value={draft.description.en} onChange={(event) => setLocalized("description", "en", event.target.value)} maxLength={1000} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسلاگ صفحه (URL)" hint="اگر خالی بماند از عنوان انگلیسی ساخته می‌شود؛ اسلاگ تکراری پذیرفته نیست.">
            <Input dir="ltr" value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="atelier-exclusive" maxLength={100} />
          </Field>
          <Field label="تصویر کاور (مسیر یا URL)">
            <Input dir="ltr" value={draft.cover} onChange={(event) => setDraft((current) => ({ ...current, cover: event.target.value }))} placeholder="/images/collections/cover.jpg" />
          </Field>
        </div>
        <MediaUploadControl mediaType="image" locale={locale} onUploaded={(cover) => setDraft((current) => ({ ...current, cover }))} />

        <div className="grid gap-4 xl:grid-cols-2">
          <ReferencePicker
            label="پترن‌های مجموعه"
            items={patterns}
            selectedIds={selectedPatternIds}
            onChange={(selected) => setDraft((current) => ({
              ...current,
              patternIds: [...new Set([
                ...current.patternIds.filter((id) => !patternIdSet.has(id)),
                ...selected,
              ])],
            }))}
          />
          <ReferencePicker
            label="محصولات مجموعه"
            items={products}
            selectedIds={selectedProductIds}
            onChange={(selected) => setDraft((current) => ({
              ...current,
              productIds: [...new Set([
                ...current.productIds.filter((id) => !productIdSet.has(id)),
                ...selected,
              ])],
            }))}
          />
        </div>

        {(issues.missingPatternIds.length > 0 || issues.missingProductIds.length > 0) && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold">این مجموعه ارجاعی به رکورد حذف‌شده یا ناموجود دارد.</p>
                {issues.missingPatternIds.length > 0 && <p dir="ltr" className="break-all">پترن: {issues.missingPatternIds.join(", ")}</p>}
                {issues.missingProductIds.length > 0 && <p dir="ltr" className="break-all">محصول: {issues.missingProductIds.join(", ")}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {issues.missingPatternIds.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft((current) => ({ ...current, patternIds: current.patternIds.filter((id) => patternIdSet.has(id)) }))}>
                  پاک‌سازی ارجاع پترن‌های ناموجود
                </Button>
              )}
              {issues.missingProductIds.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft((current) => ({ ...current, productIds: current.productIds.filter((id) => productIdSet.has(id)) }))}>
                  پاک‌سازی ارجاع محصولات ناموجود
                </Button>
              )}
            </div>
          </div>
        )}

        {draft.slug === "atelier-exclusive" && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-6 text-blue-800">
            این مجموعه علاوه بر صفحهٔ مجموعه‌ها، عنوان و توضیح هیروی فروشگاه را هم تأمین می‌کند.
          </p>
        )}

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>انصراف</Button>
          <Button type="submit" size="sm">{isNew ? "افزودن مجموعه" : "ذخیره مجموعه"}</Button>
        </div>
      </form>
    </section>
  );
}

export function CollectionsManager({
  data,
  update,
  locale,
}: {
  data: SiteContent;
  update: (patch: Partial<SiteContent>) => void;
  locale: Locale;
}) {
  const [editor, setEditor] = useState<CollectionEditorTarget>(null);
  const [search, setSearch] = useState("");
  const collections = data.collections;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCollections = useMemo(() => collections.filter((collection) => {
    if (!normalizedSearch) return true;
    return [collection.title.fa, collection.title.en, collection.slug]
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  }), [collections, normalizedSearch]);

  const openNew = () => setEditor(newCollection());
  const openEdit = (collection: Collection) => setEditor(collection);
  const cancelEdit = () => setEditor(null);

  const saveCollection = (collection: Collection) => {
    const exists = collections.some((item) => item.id === collection.id);
    update({
      collections: exists
        ? collections.map((item) => item.id === collection.id ? collection : item)
        : [...collections, collection],
    });
    setEditor(null);
  };

  const removeCollection = (collection: Collection) => {
    const title = collection.title.fa || collection.title.en || collection.slug;
    const shopWarning = collection.slug === "atelier-exclusive"
      ? " این مجموعه عنوان و توضیح هیروی فروشگاه را هم تأمین می‌کند."
      : "";
    if (!confirm(`مجموعهٔ «${title}» حذف شود؟ پترن‌ها و محصولات آن حذف نمی‌شوند.${shopWarning}`)) return;
    update({ collections: collections.filter((item) => item.id !== collection.id) });
    if (typeof editor === "object" && editor?.id === collection.id) setEditor(null);
  };

  const patternOptions = data.patterns.map((pattern) => ({ id: pattern.id }));
  const productOptions = data.products.map((product) => ({ id: product.id }));
  const brokenCount = collections.reduce((total, collection) => {
    const issues = getCollectionReferenceIssues(collection, patternOptions, productOptions);
    return total + issues.missingPatternIds.length + issues.missingProductIds.length;
  }, 0);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">مجموعه‌ها</h1>
          <p className="mt-0.5 text-xs text-muted">عنوان، کاور و پترن‌ها و محصولات هر مجموعهٔ عمومی را مدیریت کنید.</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" />
          مجموعهٔ جدید
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-4">
          <Layers3 className="h-5 w-5 text-accent" />
          <div><p className="text-xl font-bold">{collections.length}</p><p className="text-xs text-muted">مجموعه</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-4">
          <AlertTriangle className={`h-5 w-5 ${brokenCount ? "text-amber-600" : "text-emerald-600"}`} />
          <div><p className="text-xl font-bold">{brokenCount}</p><p className="text-xs text-muted">ارجاع ناموجود به پترن یا محصول</p></div>
        </div>
      </div>

      {editor && (
        <CollectionEditor
          key={editor.id}
          initialCollection={editor}
          isNew={!collections.some((item) => item.id === editor.id)}
          collections={collections}
          data={data}
          locale={locale}
          onSave={saveCollection}
          onCancel={cancelEdit}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-foreground">فهرست مجموعه‌ها</p>
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">جستجوی مجموعه‌ها</span>
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو با عنوان یا اسلاگ" className="pr-9" />
        </label>
      </div>

      {filteredCollections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-4 py-12 text-center">
          <Layers3 className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {collections.length ? "مجموعه‌ای با این جستجو پیدا نشد." : "هنوز مجموعه‌ای ساخته نشده است."}
          </p>
          {!collections.length && <p className="mt-1 text-xs text-muted">برای ساخت اولین مجموعه، روی «مجموعهٔ جدید» بزنید.</p>}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCollections.map((collection) => {
            const issues = getCollectionReferenceIssues(collection, patternOptions, productOptions);
            const hasIssues = issues.missingPatternIds.length > 0 || issues.missingProductIds.length > 0;
            return (
              <li key={collection.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <div className="relative aspect-[16/9] overflow-hidden bg-background-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={collection.cover || "/images/collections/s01.jpg"} alt={t(collection.title, locale)} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                    <h2 className="line-clamp-2 text-sm font-bold text-white">{t(collection.title, locale)}</h2>
                    <Badge tone="glass">{collection.patternIds.length + collection.productIds.length} مورد</Badge>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="line-clamp-2 min-h-10 text-xs leading-5 text-foreground-secondary">{t(collection.description, locale) || "بدون توضیحات"}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" />{collection.patternIds.length} پترن</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />{collection.productIds.length} محصول</span>
                    <code dir="ltr" className="mr-auto max-w-full truncate rounded bg-background-secondary px-1.5 py-0.5">/{collection.slug}</code>
                  </div>
                  {hasIssues && (
                    <p role="alert" className="rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-800">
                      {issues.missingPatternIds.length + issues.missingProductIds.length} ارجاع به مورد حذف‌شده؛ با ویرایش مجموعه قابل پاک‌سازی است.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <Link href={href(locale, `/collections/${collection.slug}`)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground-secondary hover:bg-background-secondary hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" /> مشاهدهٔ عمومی
                    </Link>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(collection)} aria-label={`ویرایش ${collection.title.fa}`} title="ویرایش مجموعه" className="rounded-md p-2 text-muted hover:bg-background-secondary hover:text-foreground">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => removeCollection(collection)} aria-label={`حذف ${collection.title.fa}`} title="حذف مجموعه" className="rounded-md p-2 text-muted hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
