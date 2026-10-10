"use client";
import type { ProfileStat } from "@/lib/razieh-profile";

import { PortfolioLangProvider } from "@/components/portfolio/PortfolioLangProvider";
import { PfHero } from "@/components/sections/PfHero";
import { PfAbout } from "@/components/sections/PfAbout";
import { PfPortfolio } from "@/components/sections/PfPortfolio";
import { PfPhilosophy } from "@/components/sections/PfPhilosophy";
import { PfAcademic } from "@/components/sections/PfAcademic";
import { PfContact } from "@/components/sections/PfContact";
import { useReveal } from "@/hooks/use-reveal";
import type { Locale } from "@/lib/i18n/types";
import type { Lang } from "@/lib/portfolio-translations";

function PortfolioInner({ stats }: { stats: ProfileStat[] }) {
  useReveal();
  return (
    <>
      <PfHero />
      <PfAbout stats={stats} />
      <PfPortfolio />
      <PfPhilosophy />
      <PfAcademic stats={stats} />
      <PfContact />
    </>
  );
}

export default function RaziehPortfolioClient({ locale, stats }: { locale: Locale; stats: ProfileStat[] }) {
  const lang: Lang = locale === "fa" ? "fa" : "en";
  return (
    <PortfolioLangProvider initialLang={lang}>
      <PortfolioInner stats={stats} />
    </PortfolioLangProvider>
  );
}
