import Link from "next/link";
import { AlertCircle, Clock3, XCircle } from "lucide-react";
import type { ArtistApprovalStatus } from "@/lib/artist/access";
import type { Locale } from "@/lib/i18n/types";
import { href } from "@/lib/utils";

export function ArtistApprovalNotice({
  locale,
  status,
}: {
  locale: Locale;
  status: Exclude<ArtistApprovalStatus, "approved">;
}) {
  const fa = locale === "fa";
  const Icon = status === "pending" ? Clock3 : status === "rejected" ? XCircle : AlertCircle;
  const title = status === "pending"
    ? (fa ? "درخواست هنرمندی شما در حال بررسی است" : "Your artist application is under review")
    : status === "rejected"
      ? (fa ? "درخواست هنرمندی شما تأیید نشد" : "Your artist application was not approved")
      : (fa ? "پروفایل هنرمندی پیدا نشد" : "Artist profile not found");
  const message = status === "pending"
    ? (fa
      ? "پس از تأیید دستی ادمین، پروفایل عمومی و امکانات فروشندگی فعال می‌شوند. تا آن زمان انتشار اثر، ثبت خدمت و ابزارهای فروش در دسترس نیستند."
      : "Your public profile and seller tools will activate after an administrator approves your application. Publishing works, listing services, and sales tools are unavailable until then.")
    : status === "rejected"
      ? (fa
        ? "پروفایل شما در صفحه هنرمندان نمایش داده نمی‌شود و امکانات فروش غیرفعال هستند. برای پیگیری یا اصلاح اطلاعات با پشتیبانی تماس بگیرید."
        : "Your profile is not listed publicly and seller tools are disabled. Contact support if you have questions or need to correct your application.")
      : (fa
        ? "برای این حساب پروفایل هنرمندیِ متصل پیدا نشد. لطفاً برای بررسی با پشتیبانی تماس بگیرید."
        : "This account has no linked artist profile. Please contact support so we can help.");

  return (
    <main className="container-x flex min-h-[70svh] items-center justify-center py-16" dir={fa ? "rtl" : "ltr"}>
      <section className="w-full max-w-xl rounded-3xl border border-border bg-surface p-8 text-center shadow-soft sm:p-10">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
          status === "pending" ? "bg-amber-100 text-amber-700" : status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
        }`}>
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-h2 text-foreground">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-foreground-secondary">{message}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href={href(locale, "/contact")}
            className="inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition hover:bg-primary"
          >
            {fa ? "تماس با پشتیبانی" : "Contact support"}
          </Link>
          <Link
            href={href(locale, "/")}
            className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm text-foreground transition hover:border-foreground"
          >
            {fa ? "بازگشت به خانه" : "Back to home"}
          </Link>
        </div>
      </section>
    </main>
  );
}
