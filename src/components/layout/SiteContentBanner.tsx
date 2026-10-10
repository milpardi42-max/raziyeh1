import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Banner } from "@/lib/types";
import type { Locale } from "@/lib/i18n/types";
import { contentHref, isExternalContentHref, t } from "@/lib/utils";

export function SiteContentBanner({ banner, locale }: { banner: Banner; locale: Locale }) {
  const title = t(banner.title, locale);
  const text = t(banner.text, locale);
  const destination = contentHref(locale, banner.href);
  const external = isExternalContentHref(destination);
  const content = (
    <span className="flex w-full items-center justify-center gap-2 text-center sm:gap-3">
      <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
      <strong className="font-semibold">{title}</strong>
      {text && <span className="text-white/75">{text}</span>}
      {destination && <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
    </span>
  );
  const className = "block border-b border-white/10 bg-[#1e2230] px-4 py-2.5 text-xs text-white transition-colors hover:bg-[#282e40] sm:text-sm";

  if (!destination) return <div className={className}>{content}</div>;
  if (external) {
    return <a href={destination} target={destination.startsWith("http") || destination.startsWith("//") ? "_blank" : undefined} rel={destination.startsWith("http") || destination.startsWith("//") ? "noopener noreferrer" : undefined} className={className}>{content}</a>;
  }
  return <Link href={destination} className={className}>{content}</Link>;
}
