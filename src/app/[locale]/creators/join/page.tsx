import type { Metadata } from "next";
import Image from "next/image";
import { Crown, Paintbrush, Palette, ShieldCheck, Sparkles } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { CreatorSignupForm } from "@/components/profile/CreatorSignupForm";
import { getSite } from "@/lib/data/queries";
import { dictionaries } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/types";
import { href, t } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: dictionaries[locale].nav.becomeCreator };
}

export default async function JoinPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const site = await getSite();
  const d = dictionaries[locale];
  const fa = locale === "fa";

  const perks = [
    {
      icon: Crown,
      t: fa ? "غرفه اختصاصی در صفحه هنرمندان" : "Dedicated Artists Hub Showcase",
      s: fa ? "پروفایل مستقل با امکان معرفی و فروش هر نوع هنر یا خدمت." : "Independent storefront to showcase and sell any craft or service.",
    },
    {
      icon: Paintbrush,
      t: fa ? "فروش پتینه و خدمات اختصاصی" : "Sell Patina & Bespoke Services",
      s: fa ? "دریافت سفارش مستقیم از معماران برای پتینه، نقاشی و پروژه‌ها." : "Direct project commissions from interior designers and architects.",
    },
    {
      icon: Palette,
      t: fa ? "فروش پترن و لایسنس دیجیتال" : "Digital Pattern Licensing",
      s: fa ? "کسب درآمد مستمر ماهانه از فروش پترن‌ها در مارکت‌پلیس." : "Earn monthly recurring revenue from pattern sales.",
    },
    {
      icon: ShieldCheck,
      t: fa ? "حفاظت از کپی‌رایت و قرارداد" : "Copyright & Contract Protection",
      s: fa ? "صدور لایسنس رسمی و قراردادهای شفاف برای تمام آثار." : "Official license certificates and clear buyer contracts.",
    },
  ];

  const heroImage = site.artists[1]?.cover ?? site.artists[0]?.cover ?? site.hero.image;

  const breadcrumb = [
    { label: d.nav.home, href: href(locale, "/") },
    { label: d.nav.artists, href: href(locale, "/artists") },
    { label: d.nav.becomeCreator },
  ];

  const options = fa
    ? [
        "طراحی پترن و پترن‌های سطح (Surface Designer)",
        "هنرمند و مجری پتینه و بافت دیوار (Patina & Wall Finishes)",
        "تصویرگر و چاپ پارچه (Illustrator & Textile)",
        "نقاشی لوکس و اسلیمی معاصر (Luxury Ornament)",
        "نقاشی دیواری و تابلوهای سفارشی (Murals & Canvas Art)",
        "استودیو هنر و معماری (Art & Architecture Studio)",
      ]
    : [
        "Surface & Pattern Designer",
        "Patina & Decorative Wall Artist",
        "Illustrator & Textile Designer",
        "Luxury & Persian Ornament Master",
        "Custom Canvas Art & Muralist",
        "Art & Architecture Studio",
      ];

  return (
    <>
      <PageHero
        eyebrow={d.nav.artists}
        title={d.nav.becomeCreator}
        description={
          fa
            ? "پروفایل اختصاصی خود را در صفحه هنرمندان بسازید. علاوه بر فروش پترن‌ها، خدمات پتینه، نقاشی دیواری و پروژه‌های اختصاصی خود را به مشتریان و معماران ارائه دهید."
            : "Build your dedicated showcase on the Artists Hub. Sell repeat patterns, wall patina finishes, and bespoke architectural commissions."
        }
        image={heroImage}
        breadcrumb={breadcrumb}
        locale={locale}
        zoomDirection="in"
      />

      <section className="container-x pb-24">
        {/* Perks */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((p, i) => (
            <Reveal key={p.t} delay={i * 60} className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground text-sm">{p.t}</h3>
              <p className="mt-1.5 text-xs text-foreground-secondary leading-relaxed">{p.s}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-12 items-start">
          {/* Left: existing artists */}
          <div className="lg:col-span-5 rounded-3xl border border-border bg-surface p-6 shadow-soft space-y-4">
            <div>
              <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{fa ? "جامعه هنرمندان" : "Artist Community"}</span>
              </div>
              <h2 className="mt-1 font-display text-xl font-bold text-foreground">
                {fa ? "طراحان و اساتید همراه ما" : "Designers & Masters With Us"}
              </h2>
              <p className="mt-1 text-xs text-foreground-secondary">
                {fa ? "شما نیز می‌توانید به عنوان هنرمند عضو شده و غرفه اختصاصی خود را داشته باشید." : "Join our creators directory and launch your dedicated storefront."}
              </p>
            </div>

            <ul className="divide-y divide-border text-xs">
              {site.artists.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-border">
                    <Image src={a.avatar} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground truncate">{t(a.name, locale)}</span>
                      {a.subscription?.status === "active" && (
                        <span className="rounded-full bg-accent/15 px-1.5 py-0.2 text-[9px] font-bold text-accent">PRO</span>
                      )}
                    </div>
                    <span className="block text-[11px] text-foreground-secondary truncate">
                      {t(a.profession, locale)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: signup form */}
          <div className="lg:col-span-7 rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-soft">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase">
                <Crown className="h-3.5 w-3.5" />
                <span>{fa ? "عضویت هنرمند طراح" : "Artist Onboarding"}</span>
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold text-foreground">
                {fa ? "فرم ثبت‌نام و فعال‌سازی غرفه اختصاصی" : "Register & Launch Your Storefront"}
              </h2>
              <p className="mt-1 text-xs text-foreground-secondary">
                {fa
                  ? "با تکمیل این فرم، پروفایل شما در صفحه هنرمندان ثبت شده و بلافاصله به تب اقتصادی پنل هنرمند دسترسی پیدا خواهید کرد."
                  : "Complete this form to create your directory listing and unlock your Pro Showcase tab."}
              </p>
            </div>

            <CreatorSignupForm options={options} />
          </div>
        </div>
      </section>
    </>
  );
}
