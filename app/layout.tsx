import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import { auth } from "@/auth";
import Shell from "@/components/Shell";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return {
  metadataBase: new URL("https://bill.wonglao.com"),
  title: {
    default: translate(locale, "meta.title"),
    template: translate(locale, "meta.titleTemplate"),
  },
  description:
    translate(locale, "meta.description"),
};
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f7f6",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = await requestLocale();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip-link" href="#content">
          {translate(locale, "nav.skipToContent")}
        </a>
        <LanguageProvider locale={locale}>
        <Providers session={session}>
          <Shell>{children}</Shell>
        </Providers>
        </LanguageProvider>
      </body>
    </html>
  );
}
