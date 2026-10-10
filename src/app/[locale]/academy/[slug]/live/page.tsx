import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/data/queries";
import { getAllReservations } from "@/lib/data/reservations";
import { getSession } from "@/lib/auth";
import { effectiveLiveStatus, hasGrantedReservation, isFreePrice, safeExternalHttpsUrl } from "@/lib/academy-live";
import { type Locale } from "@/lib/i18n/types";
import { t } from "@/lib/utils";
import WebinarViewer from "@/components/academy/WebinarViewer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

function AccessNotice({ locale, title, message, slug, showLogin = false }: { locale: Locale; title: string; message: string; slug: string; showLogin?: boolean }) {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-background px-6 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
        <h1 className="font-display text-h3 text-foreground">{title}</h1>
        <p className="mt-3 text-body-sm leading-7 text-foreground-secondary">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {showLogin && <Link href={`/${locale}/login`} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">{locale === "fa" ? "ورود / ساخت حساب" : "Sign in / create account"}</Link>}
          <Link href={`/${locale}/academy/${slug}`} className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent hover:text-accent">{locale === "fa" ? "صفحه رویداد" : "Event details"}</Link>
        </div>
      </div>
    </main>
  );
}

export default async function LivePage({ params }: Props) {
  const { locale, slug } = await params;
  const [site, reservations, session] = await Promise.all([getSite(), getAllReservations(), getSession()]);
  const item = site.education.find((entry) => entry.slug === slug && (entry.type === "webinar" || entry.type === "workshop"));
  if (!item) notFound();

  const event = item.liveEvent;
  if (!event) {
    return <AccessNotice locale={locale} title={t(item.title, locale)} slug={slug}
      message={locale === "fa" ? "تنظیمات این رویداد هنوز کامل نشده است." : "This event has not been configured for online access yet."} />;
  }

  const eventStatus = effectiveLiveStatus(event) ?? "ended";
  if (eventStatus === "ended" || eventStatus === "cancelled") {
    return <AccessNotice locale={locale} title={t(item.title, locale)} slug={slug}
      message={eventStatus === "cancelled"
        ? locale === "fa" ? "این رویداد لغو شده است." : "This event has been cancelled."
        : locale === "fa" ? "این رویداد به پایان رسیده است؛ ورود زنده دیگر فعال نیست." : "This event has ended; live access is closed."} />;
  }

  const paid = !isFreePrice(item.price);
  const accessGranted = hasGrantedReservation(reservations, item.slug, session);
  if (paid && !accessGranted) {
    return <AccessNotice locale={locale} title={t(item.title, locale)} slug={slug} showLogin
      message={locale === "fa"
        ? "این رویداد پولی است. لینک ورود پس از ثبت‌نام و تأیید پرداخت در پنل آکادمی فعال می‌شود. برای دسترسی، با همان ایمیل ثبت‌نام وارد حساب خود شوید."
        : "This is a paid event. Join access is enabled after enrolment and payment approval in the academy panel. Sign in with the same email used to register."} />;
  }

  if (!event.isOnline) {
    return <AccessNotice locale={locale} title={t(item.title, locale)} slug={slug}
      message={locale === "fa" ? "این رویداد حضوری است و پخش آنلاین برای آن فعال نشده است." : "This event is in person; online streaming is not enabled."} />;
  }

  const stream = event.webinarStream;
  let hlsUrl: string | undefined;
  if (stream?.source === "external" && item.type === "webinar") {
    if (!safeExternalHttpsUrl(stream.hlsUrl)) {
      return <AccessNotice locale={locale} title={t(item.title, locale)} slug={slug}
        message={locale === "fa" ? "آدرس پخش HLS معتبر پیکربندی نشده است. از مدیر آکادمی بخواهید تنظیمات پخش را کامل کند." : "A valid external HLS playback URL is not configured yet. Ask the academy admin to finish the stream settings."} />;
    }
    hlsUrl = `/api/webinar/${encodeURIComponent(slug)}/stream`;
  } else if (stream?.source === "external" && item.type === "workshop" && !safeExternalHttpsUrl(event.meetLink)) {
    return <AccessNotice locale={locale} title={t(item.title, locale)} slug={slug}
      message={locale === "fa" ? "لینک جلسه خارجی هنوز به‌درستی تنظیم نشده است." : "The external meeting link has not been configured correctly."} />;
  }

  const registeredCount = reservations.filter((reservation) => reservation.eventSlug === slug && reservation.status !== "cancelled").length;
  const prefillName = session?.name ?? "";
  const prefillEmail = session?.email ?? "";
  const title = t(item.title, locale);
  const hostName = event.hostNameCustom && event.hostName
    ? t(event.hostName, locale)
    : locale === "fa" ? "راضیه خیری پور" : "Razieh Khairipour";

  return (
    <WebinarViewer
      slug={slug}
      title={title}
      image={item.image}
      hostName={hostName}
      startsAt={event.startsAt}
      durationMin={event.durationMin}
      capacity={event.capacity}
      registeredCount={registeredCount}
      eventStatus={eventStatus}
      chatEnabled={stream?.chatEnabled ?? true}
      qaEnabled={stream?.qaEnabled ?? true}
      requiresAccount={paid}
      prefillName={prefillName}
      prefillEmail={prefillEmail}
      hlsUrl={hlsUrl}
      locale={locale}
    />
  );
}
