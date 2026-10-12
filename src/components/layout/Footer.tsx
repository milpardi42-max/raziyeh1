"use client";

import Link from "next/link";
import { ArrowUp, ArrowUpRight, Camera, Mail, MapPin, Phone, PlayCircle, Send, Sparkles, Users } from "lucide-react";
import { useAuth, useLocale, useTheme } from "@/components/providers/AppProviders";
import { href } from "@/lib/utils";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";
import { Reveal } from "@/components/ui/Reveal";
import { usePathname } from "next/navigation";
import { faNum } from "@/lib/utils";

export function Footer() {
  const { locale, dict } = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const fa = locale === "fa";
  const other = locale === "fa" ? "en" : "fa";
  const switchHref = pathname.replace(new RegExp(`^/${locale}`), `/${other}`) || `/${other}`;
  const year = new Date().getFullYear();

  const socials = [
    { icon: Camera, label: "Instagram", href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com" },
    { icon: Send, label: "Telegram", href: process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me" },
    { icon: Users, label: "Facebook", href: process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://facebook.com" },
    { icon: PlayCircle, label: "YouTube", href: process.env.NEXT_PUBLIC_YOUTUBE_URL || "https://youtube.com" },
    { icon: Mail, label: "Email", href: "mailto:hello@rosieatelier.com" },
  ];

  const cols = [
    {
      title: dict.footer.discover,
      links: [
        [dict.nav.patterns, "/patterns"],
        [dict.nav.products, "/shop"],
        [fa ? "فایل دیجیتال و لایسنس" : "Digital files & licensing", "/marketplace"],
        [fa ? "اشتراک دانلود" : "Download passes", "/marketplace/subscriptions"],
        [dict.nav.artists, "/artists"],
        [dict.nav.portfolio, "/portfolio"],
        [dict.nav.education, "/academy"],
        [dict.nav.collections, "/collections"],
      ],
    },
    {
      title: dict.footer.company,
      links: [
        [dict.nav.projects, "/projects"],
        [dict.nav.custom, "/custom"],
        [dict.nav.stories, "/stories"],
        [dict.nav.becomeCreator, "/creators/join"],
        [fa ? "میز کار فروش هنرمند" : "Artist sales studio", "/artist/marketplace"],
      ],
    },
    {
      title: dict.footer.support,
      links: [
        [dict.footer.faq, "/faq"],
        [dict.footer.returns, "/returns"],
        [dict.nav.contact, "/contact"],
        [dict.nav.account, user ? "/account" : "/login"],
        [fa ? "راستی‌آزمایی گواهی" : "Verify a certificate", "/verify"],
        ...(user?.role === "admin" ? ([[dict.nav.admin, "/admin"]] as [string, string][]) : []),
      ],
    },
    {
      title: dict.footer.legal,
      links: [
        [dict.footer.privacy, "/legal/privacy"],
        [dict.footer.terms, "/legal/terms"],
        [dict.footer.licenses, "/legal/licenses"],
      ],
    },
  ];

  return (
    <footer className="site-footer relative isolate mt-24 overflow-hidden border-t border-border bg-background">
      <div className="site-footer__ambient" aria-hidden="true">
        <span className="site-footer__ambient-orbit" />
        <span className="site-footer__ambient-glow site-footer__ambient-glow--one" />
        <span className="site-footer__ambient-glow site-footer__ambient-glow--two" />
      </div>
      <div className="gradient-strip site-footer__top-rule absolute inset-x-0 top-0" />

      <div className="container-x site-footer__inner relative z-10 pt-14 pb-8 md:pt-20">
        {/* ── Brand, newsletter and contact ─────────────────────────────── */}
        <div className="site-footer__showcase grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Reveal as="div" variant="blur" delay={0} className="site-footer__brand-card">
            <span className="site-footer__card-glow" aria-hidden="true" />
            <div className="site-footer__brand-content">
              <Link href={href(locale, "/")} className="site-footer__brand-link" aria-label={dict.brand}>
                <Logo className="text-[19px] text-foreground" />
              </Link>
              <p className="site-footer__about mt-5 max-w-sm text-body-sm leading-7 text-foreground-secondary">{dict.footer.about}</p>
            </div>
            <div className="site-footer__social-area">
              <p className="mb-3 text-xs font-medium text-muted">{fa ? "ما را در شبکه‌های اجتماعی دنبال کنید" : "Follow us on social media"}</p>
              <div className="flex flex-wrap items-center gap-2" aria-label={fa ? "شبکه‌های اجتماعی" : "Social media links"}>
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target={s.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={s.href.startsWith("mailto:") ? undefined : "noreferrer"}
                    aria-label={s.label}
                    title={s.label}
                    className="site-footer__social-link flex h-10 w-10 items-center justify-center rounded-full glass text-foreground"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="site-footer__feature-grid grid gap-5 md:grid-cols-2">
            <Reveal as="div" variant="blur" delay={90} className="site-footer__card site-footer__newsletter-card">
              <div className="site-footer__card-heading flex items-center gap-3">
                <span className="site-footer__card-icon flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-foreground">{dict.common.newsletterTitle}</p>
              </div>
              <p className="site-footer__card-copy mt-4 text-xs leading-6 text-foreground-secondary">
                {fa
                  ? "اولین نفرهایی باشید که پترن‌های جدید، تخفیف‌ها و رویدادهای آکادمی را می‌بینید."
                  : "Be the first to see new patterns, special offers and academy events."}
              </p>
              <NewsletterForm compact className="site-footer__newsletter-form mt-5" />
            </Reveal>

            <Reveal as="div" variant="blur" delay={170} className="site-footer__card site-footer__contact-card">
              <p className="text-sm font-semibold text-foreground">{dict.footer.contactTitle}</p>
              <ul className="site-footer__contact-list mt-4 space-y-3.5 text-sm text-foreground-secondary">
                <li className="site-footer__contact-row flex items-center gap-3">
                  <span className="site-footer__contact-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary text-accent">
                    <MapPin className="h-4 w-4" />
                  </span>
                  {fa ? "تهران، خیابان ولیعصر" : "Valiasr St., Tehran"}
                </li>
                <li className="site-footer__contact-row flex items-center gap-3">
                  <span className="site-footer__contact-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary text-accent">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span dir="ltr">+98 21 8800 0000</span>
                </li>
                <li className="site-footer__contact-row flex items-center gap-3">
                  <span className="site-footer__contact-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary text-accent">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span dir="ltr">hello@rosieatelier.com</span>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>

        {/* ── Link directory ────────────────────────────────────────────── */}
        <div className="site-footer__directories mt-12 pt-10 md:mt-16 md:pt-12">
          <div className="site-footer__directory-grid grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-x-8">
            {cols.map((c, index) => (
              <Reveal key={c.title} as="div" variant="fade" delay={index * 65} className="site-footer__link-column">
                <p className="site-footer__column-title flex items-center gap-2.5 text-label text-muted">
                  <span aria-hidden className="site-footer__column-marker h-3.5 w-1 rounded-full bg-accent" />
                  {c.title}
                </p>
                <ul className="site-footer__link-list mt-5 space-y-3">
                  {c.links.map(([label, path]) => (
                    <li key={path}>
                      <Link href={href(locale, path)} className="site-footer__link text-sm text-foreground-secondary">
                        {label}
                        <ArrowUpRight aria-hidden="true" className="site-footer__link-arrow rtl-flip h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── Copyright and controls ────────────────────────────────────── */}
        <div className="site-footer__bottom mt-10 flex flex-col gap-4 pt-6 text-caption text-foreground-secondary md:mt-12 md:flex-row md:items-center md:justify-between">
          <p>
            © {fa ? faNum(year) : year} Rosie Atelier · {dict.footer.founder} · {dict.footer.rights}
          </p>
          <div className="site-footer__controls flex flex-wrap items-center gap-2.5">
            <Link
              href={switchHref}
              className="site-footer__control rounded-full border border-border px-3 py-1.5"
            >
              {other === "fa" ? "فارسی" : "English"}
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="site-footer__control rounded-full border border-border px-3 py-1.5"
            >
              {theme === "dark" ? (fa ? "روشن" : "Light") : fa ? "تاریک" : "Dark"}
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label={fa ? "بازگشت به بالای صفحه" : "Back to top"}
              title={fa ? "بازگشت به بالا" : "Back to top"}
              className="site-footer__control site-footer__back-to-top flex h-9 w-9 items-center justify-center rounded-full border border-border"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
