import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getSite } from "@/lib/data/queries";
import { effectiveLiveStatus } from "@/lib/academy-live";
import { type Locale } from "@/lib/i18n/types";
import { t } from "@/lib/utils";
import WebinarBroadcast from "@/components/academy/WebinarBroadcast";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export default async function BroadcastPage({ params }: Props) {
  const { locale, slug } = await params;

  // Admin-only
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    redirect(`/${locale}/login`);
  }

  // Verify the event exists and is configured for camera streaming
  const site = await getSite();
  const item = site.education.find(
    (e) => e.slug === slug && (e.type === "webinar" || e.type === "workshop")
  );
  if (!item) notFound();
  const eventStatus = effectiveLiveStatus(item.liveEvent);
  if (!item.liveEvent?.isOnline || eventStatus === "ended" || eventStatus === "cancelled") {
    redirect(`/${locale}/academy/${slug}`);
  }

  // Only explicitly external events use their configured meeting link instead.
  if (item.liveEvent.webinarStream?.source === "external") {
    redirect(`/${locale}/academy/${slug}`);
  }

  return <WebinarBroadcast slug={slug} title={t(item.title, locale)} />;
}
