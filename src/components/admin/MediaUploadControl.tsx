"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";

export function MediaUploadControl({
  mediaType,
  onUploaded,
  locale = "fa",
}: {
  mediaType: "image" | "video";
  onUploaded: (url: string) => void;
  locale?: "fa" | "en";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fa = locale === "fa";
  const isVideo = mediaType === "video";
  const accept = isVideo ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/avif";

  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (isVideo) form.append("fileType", "video");
      const response = await fetch(isVideo ? "/api/admin/academy/upload-video" : "/api/artist/upload", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const result = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !result.ok || !result.url) {
        const errors: Record<string, { fa: string; en: string }> = {
          unauthorized: { fa: "برای آپلود وارد پنل مدیریت شوید.", en: "Sign in as an administrator to upload." },
          unsupported_video_type: { fa: "فقط ویدئوی MP4 یا WebM پذیرفته می‌شود.", en: "Only MP4 and WebM videos are supported." },
          unsupported_type: { fa: "فرمت تصویر پشتیبانی نمی‌شود.", en: "Unsupported image format." },
          file_too_large: { fa: "حجم فایل بیش از حد مجاز است.", en: "The file exceeds the allowed size." },
          content_length_required: { fa: "سرور اندازه درخواست آپلود را دریافت نکرد؛ محدودیت پراکسی را بررسی کنید.", en: "The server could not read the upload length; check the proxy upload limits." },
          invalid_video_data: { fa: "فایل ویدئو معتبر نیست یا با پسوند آن هم‌خوانی ندارد.", en: "Invalid video data or file extension mismatch." },
          invalid_image_data: { fa: "فایل تصویر معتبر نیست یا با پسوند آن هم‌خوانی ندارد.", en: "Invalid image data or file extension mismatch." },
          storage_error: { fa: "ذخیره‌سازی رسانه تنظیم نشده یا در دسترس نیست.", en: "Media storage is not configured or is unavailable." },
        };
        const message = errors[result.error ?? ""];
        throw new Error(message ? (fa ? message.fa : message.en) : (fa ? "آپلود ناموفق بود؛ دوباره تلاش کنید." : "Upload failed; please try again."));
      }
      onUploaded(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : (fa ? "ارتباط با سرور برقرار نشد." : "Could not reach the server."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <input ref={input} type="file" accept={accept} className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? (fa ? "در حال آپلود…" : "Uploading…") : isVideo ? (fa ? "آپلود ویدئوی MP4/WebM" : "Upload MP4/WebM video") : (fa ? "آپلود تصویر" : "Upload image")}
      </button>
      {error && <p role="alert" className="max-w-xl text-xs text-red-600">{error}</p>}
    </div>
  );
}
