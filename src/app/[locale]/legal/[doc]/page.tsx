import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getSite } from "@/lib/data/queries";
import { dictionaries } from "@/lib/i18n/dictionary";
import { TERMS } from "@/lib/legal/terms";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { href } from "@/lib/utils";

const docs = ["privacy", "terms", "licenses"] as const;
type Doc = (typeof docs)[number];
type Props = { params: Promise<{ locale: Locale; doc: string }> };

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => docs.map((doc) => ({ locale, doc })));
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, doc } = await params;
  const d = dictionaries[locale];
  return { title: d.footer[doc as Doc] ?? d.footer.legal };
}
export default async function LegalPage({ params }: Props) {
  const { locale, doc } = await params;
  if (!docs.includes(doc as Doc)) notFound();
  const site = await getSite();
  const d = dictionaries[locale];
  const fa = locale === "fa";
  const body: Record<Doc, string[]> = {
    privacy: fa ? ["ما فقط داده‌هایی را جمع‌آوری می‌کنیم که برای ارائه‌ی سرویس لازم است: ایمیل، سفارش‌ها و علاقه‌مندی‌ها.", "داده‌ها به هیچ شخص ثالثی فروخته نمی‌شود."] : ["We only collect data needed to provide the service: email, orders and favourites.", "Data is never sold to third parties."],
    terms: [], // rendered from the shared TERMS source below
    licenses: fa ? ["لایسنس شخصی: استفاده در فضای شخصی، بدون فروش.", "لایسنس تجاری: چاپ و فروش تا ۵۰۰ واحد یا یک پروژه.", "لایسنس گسترده: نامحدود، شامل برندینگ."] : ["Personal: use in your own space, no resale.", "Commercial: print and sell up to 500 units or one project.", "Extended: unlimited, including branding."],
  };

  const termsDoc = doc as Doc === "terms" ? TERMS[locale] : null;

  const breadcrumb = [
    { label: d.nav.home, href: href(locale, "/") },
    { label: d.footer.legal, href: href(locale, "/legal/privacy") },
    { label: d.footer[doc as Doc] },
  ];

  return (
    <>
      <PageHero
        eyebrow={d.footer.legal}
        title={d.footer[doc as Doc]}
        image={site.hero.image}
        breadcrumb={breadcrumb}
        locale={locale}
        zoomDirection="out"
      />
      <div className="container-x prose-ra pb-20">
        {termsDoc ? (
          <article>
            {termsDoc.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {termsDoc.sections.map((s) => (
              <section key={s.title}>
                <h3>{s.title}</h3>
                {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
                {s.bullets && (
                  <ul>
                    {s.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <p className="mt-8 text-sm text-muted">{termsDoc.contactNote}</p>
          </article>
        ) : (
          body[doc as Doc].map((p) => <p key={p}>{p}</p>)
        )}
      </div>
    </>
  );
}
