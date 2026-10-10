import type { Metadata, Viewport } from "next";
import "../../globals.css";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/providers/AppProviders";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { getCspNonce } from "@/lib/security/nonce";

export const metadata: Metadata = {
  robots: { index: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "پنل رزی",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#b5713a" },
    { media: "(prefers-color-scheme: dark)", color: "#d38f55" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `(function(){try{var t=localStorage.getItem('ra-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export default async function AdminLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const nonce = await getCspNonce();
  if (!LOCALES.includes(raw as Locale)) notFound();
  const locale = raw as Locale;

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link
          rel="preload"
          href="/fonts/iransanse-web/IRANSansWeb.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-dvh bg-[#f0f2f5]">
        <PwaRegister />
        <PwaInstallPrompt />
        <AppProviders locale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
