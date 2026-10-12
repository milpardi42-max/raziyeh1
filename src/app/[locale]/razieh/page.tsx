import { getSite } from "@/lib/data/queries";
import { founderStatistics } from "@/lib/data/founder-statistics";
export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/types";
import { getEditableRouteMetadata } from "@/lib/site-seo";
import RaziehPortfolioClient from "./RaziehClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  return getEditableRouteMetadata(
    "/razieh",
    locale,
    locale === "fa" ? "راضیه خیری‌پور — طراح پترن" : "Razieh Kheiripour — Pattern Designer",
  );
}

export default async function RaziehPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RaziehPortfolioClient locale={locale as Locale} stats={await founderStatistics(await getSite())} />;
}
