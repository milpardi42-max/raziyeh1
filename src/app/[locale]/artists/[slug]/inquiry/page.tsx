import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistInquiryForm } from "@/components/profile/ArtistInquiryForm";
import { getSite } from "@/lib/data/queries";
import { href, t } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/types";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{ service?: string }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const artist = (await getSite()).artists.find(
    (a) => a.slug === slug && (!a.status || a.status === "approved"),
  );
  return {
    title: artist
      ? `${locale === "fa" ? "درخواست همکاری با" : "Work with"} ${t(artist.name, locale)}`
      : undefined,
    robots: { index: false, follow: true },
  };
}
export default async function InquiryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { service } = await searchParams;
  const artist = (await getSite()).artists.find(
    (a) => a.slug === slug && (!a.status || a.status === "approved"),
  );
  if (!artist) notFound();
  const services = (artist.services ?? []).filter((s) => s.active !== false);
  if (!artist.acceptsCommissions && services.length === 0) notFound();
  const fa = locale === "fa";
  return (
    <div className="container-x pb-16 pt-[calc(var(--announce-h,0px)+var(--header-h)+2rem)]">
      <Link
        href={href(locale, `/artists/${slug}`)}
        className="text-sm text-accent hover:underline"
      >
        {fa ? "بازگشت به پروفایل" : "Back to profile"} ·{" "}
        {t(artist.name, locale)}
      </Link>
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">
            {fa ? "شروع یک همکاری" : "A new collaboration"}
          </p>
          <h1 className="mt-4 font-display text-3xl leading-relaxed md:text-4xl">
            {fa ? "درخواست همکاری با" : "Work with"}
            <br />
            {t(artist.name, locale)}
          </h1>
          <p className="mt-5 text-sm leading-8 text-foreground-secondary">
            {artist.commissionNotice
              ? t(artist.commissionNotice, locale)
              : fa
                ? "دربارهٔ ایده و نیازهای خود بنویسید تا هنرمند بتواند محدودهٔ کار و شرایط همکاری را بررسی کند."
                : "Share your idea and requirements so the artist can review the scope and discuss how to collaborate."}
          </p>
        </div>
        <ArtistInquiryForm
          artistId={artist.id}
          artistSlug={artist.slug}
          services={services.map((s) => ({ id: s.id, title: s.title }))}
          selectedService={
            services.some((s) => s.id === service) ? service : undefined
          }
        />
      </div>
    </div>
  );
}
