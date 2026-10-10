"use client";

import Link from "next/link";
import { ArrowUp, Camera, Mail, MapPin, Phone, PlayCircle, Send, Sparkles, Users } from "lucide-react";
import { useAuth, useLocale, useTheme } from "@/components/providers/AppProviders";
import { href } from "@/lib/utils";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";
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
    <footer className="relative mt-24 border-t border-border bg-background">
      <div className="gradient-strip absolute inset-x-0 top-0" />
      <div className="container-x pt-16 pb-8">
        {/* ── Top: brand · newsletter · contact ─────────────────────────── */}
        <div className="grid gap-10 lg:grid-cols-12">
          {/* brand */}
          <div className="lg:col-span-4">
            <Link href={href(locale, "/")} className="inline-flex items-center" aria-label={dict.brand}>
              <Logo className="text-[19px] text-foreground" />
            </Link>
            <p className="mt-5 max-w-sm text-body-sm leading-7 text-foreground-secondary">{dict.footer.about}</p>
            <p className="mt-7 text-xs font-medium text-muted">{fa ? "ما را در شبکه‌های اجتماعی دنبال کنید" : "Follow us on social media"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={fa ? "شبکه‌های اجتماعی" : "Social media links"}>
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={s.href.startsWith("mailto:") ? undefined : "noreferrer"}
                  aria-label={s.label}
                  title={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full glass text-foreground transition-[transform,box-shadow,color] duration-200 hover:-translate-y-0.5 hover:text-accent hover:shadow-soft"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* newsletter card */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 via-surface to-surface p-6 lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-foreground">{dict.common.newsletterTitle}</p>
            </div>
            <p className="mt-3 text-xs leading-6 text-foreground-secondary">
              {fa
                ? "اولین نفرهایی باشید که پترن‌های جدید، تخفیف‌ها و رویدادهای آکادمی را می‌بینید."
                : "Be the first to see new patterns, special offers and academy events."}
            </p>
            <NewsletterForm compact className="mt-5" />
          </div>

          {/* contact card */}
          <div className="rounded-2xl border border-border bg-surface p-6 lg:col-span-4">
            <p className="text-sm font-semibold text-foreground">{dict.footer.contactTitle}</p>
            <ul className="mt-4 space-y-3.5 text-sm text-foreground-secondary">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-accent">
                  <MapPin className="h-4 w-4" />
                </span>
                {fa ? "تهران، خیابان ولیعصر" : "Valiasr St., Tehran"}
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-accent">
                  <Phone className="h-4 w-4" />
                </span>
                <span dir="ltr">+98 21 8800 0000</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-accent">
                  <Mail className="h-4 w-4" />
                </span>
                <span dir="ltr">hello@rosieatelier.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Middle: link columns ───────────────────────────────────────── */}
        <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-border pt-12 md:grid-cols-4">
          {cols.map((c) => (
            <div key={c.title}>
              <p className="flex items-center gap-2.5 text-label text-muted">
                <span aria-hidden className="h-3.5 w-1 rounded-full bg-accent" />
                {c.title}
              </p>
              <ul className="mt-5 space-y-3">
                {c.links.map(([label, path]) => (
                  <li key={path}>
                    <Link
                      href={href(locale, path)}
                      className="text-sm text-foreground-secondary underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline hover:decoration-accent/50"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom: copyright · controls ───────────────────────────────── */}
        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-caption text-foreground-secondary md:flex-row md:items-center md:justify-between">
          <p>
            © {fa ? faNum(year) : year} Rosie Atelier · {dict.footer.founder} · {dict.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={switchHref}
              className="rounded-full border border-border px-3 py-1.5 transition-colors hover:border-foreground hover:text-foreground"
            >
              {other === "fa" ? "فارسی" : "English"}
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="rounded-full border border-border px-3 py-1.5 transition-colors hover:border-foreground hover:text-foreground"
            >
              {theme === "dark" ? (fa ? "روشن" : "Light") : fa ? "تاریک" : "Dark"}
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label={fa ? "بازگشت به بالای صفحه" : "Back to top"}
              title={fa ? "بازگشت به بالا" : "Back to top"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground hover:text-foreground"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
