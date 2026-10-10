import type { Metadata } from "next";
import "./globals.css";
import { dirOf, type Locale } from "@/lib/i18n/types";

export const metadata: Metadata = {
  metadataBase: new URL("https://rosieatelier.com"),
  title: "Rosie Atelier",
  description: "Pattern, design, creativity and lifestyle.",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale?: string }> }>) {
  const { locale } = await params;
  const lang = (locale as Locale) ?? "fa";
  const dir = dirOf(lang);

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
