"use client";

import { MediaUploadControl } from "@/components/admin/MediaUploadControl";
import type { FirstProductVariantError } from "@/lib/product-variants";

export interface FirstProductVariantFormValues {
  nameFa: string;
  nameEn: string;
  hex: string;
  image: string;
  stock: string;
}

export const EMPTY_FIRST_PRODUCT_VARIANT: FirstProductVariantFormValues = {
  nameFa: "",
  nameEn: "",
  hex: "#8fa08e",
  image: "",
  stock: "1",
};

const ERROR_MESSAGES: Record<FirstProductVariantError, string> = {
  "id-required": "شناسه واریانت معتبر نیست؛ دوباره تلاش کنید.",
  "name-fa-required": "نام فارسی واریانت را وارد کنید.",
  "name-en-required": "نام انگلیسی واریانت را وارد کنید.",
  "invalid-color": "یک رنگ معتبر انتخاب کنید.",
  "image-required": "آدرس تصویر را وارد یا تصویر را آپلود کنید.",
  "invalid-stock": "موجودی باید عدد صحیح و صفر یا بیشتر باشد.",
};

export function FirstProductVariantFields({
  value,
  onChange,
  error,
}: {
  value: FirstProductVariantFormValues;
  onChange: (patch: Partial<FirstProductVariantFormValues>) => void;
  error?: FirstProductVariantError | null;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-background-secondary/60 p-3" aria-labelledby="first-variant-heading">
      <div>
        <h4 id="first-variant-heading" className="text-sm font-semibold text-foreground">واریانت اول (اجباری)</h4>
        <p className="mt-0.5 text-[11px] text-muted">نام دو زبانه، رنگ، تصویر و موجودی اولیه را وارد کنید.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-foreground-secondary">
          نام واریانت به فارسی *
          <input
            required
            type="text"
            dir="rtl"
            value={value.nameFa}
            onChange={(event) => onChange({ nameFa: event.target.value })}
            placeholder="مثلاً کرم روشن"
            className="mt-1 h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="block text-xs font-medium text-foreground-secondary">
          نام واریانت به انگلیسی *
          <input
            required
            type="text"
            dir="ltr"
            value={value.nameEn}
            onChange={(event) => onChange({ nameEn: event.target.value })}
            placeholder="e.g. Light cream"
            className="mt-1 h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-foreground-secondary">
          رنگ *
          <span className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-2">
            <input
              aria-label="رنگ واریانت"
              type="color"
              value={value.hex}
              onChange={(event) => onChange({ hex: event.target.value })}
              className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
            />
            <span dir="ltr" className="font-mono text-xs text-muted">{value.hex.toUpperCase()}</span>
          </span>
        </label>
        <label className="block text-xs font-medium text-foreground-secondary">
          موجودی اولیه *
          <input
            required
            type="number"
            min="0"
            step="1"
            dir="ltr"
            value={value.stock}
            onChange={(event) => onChange({ stock: event.target.value })}
            className="mt-1 h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
      </div>

      <label className="block text-xs font-medium text-foreground-secondary">
        تصویر واریانت *
        <input
          required
          type="text"
          dir="ltr"
          value={value.image}
          onChange={(event) => onChange({ image: event.target.value })}
          placeholder="/api/media/… یا نشانی تصویر"
          className="mt-1 h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <MediaUploadControl mediaType="image" locale="fa" onUploaded={(image) => onChange({ image })} />

      {error && <p role="alert" className="text-xs font-medium text-error">{ERROR_MESSAGES[error]}</p>}
    </section>
  );
}
