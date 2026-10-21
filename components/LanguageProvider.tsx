"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { translate, translateFeedback, type TranslationKey } from "@/lib/i18n";
import { localizedPath, type Locale } from "@/lib/locale";

const LanguageContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: "th", setLocale: () => {},
});
export function LanguageProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const [currentLocale, setCurrentLocale] = useState(locale);
  const router = useRouter();
  useEffect(() => { setCurrentLocale(locale); }, [locale]);
  useEffect(() => { document.documentElement.lang = currentLocale; }, [currentLocale]);
  const setLocale = useCallback((next: Locale) => {
    document.cookie = `clear-toh-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.lang = next;
    setCurrentLocale(next);
    // Update server-rendered copy and metadata, preserving the URL and client state.
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({ locale: currentLocale, setLocale }), [currentLocale, setLocale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useI18n() {
  const { locale, setLocale } = useContext(LanguageContext);
  return useMemo(() => ({
    locale,
    setLocale,
    formatLocale: locale === "th" ? "th-TH" : "en-GB",
    t: (key: TranslationKey, values?: readonly unknown[]) => translate(locale, key, values),
    feedback: (message: string) => translateFeedback(locale, message),
    href: (path: string) => localizedPath(path, locale),
  }), [locale, setLocale]);
}
export function useLocalizedRouter() {
  const router = useRouter();
  const { href } = useI18n();
  return useMemo(() => ({ ...router,
    push: (path: string) => router.push(href(path)),
    replace: (path: string) => router.replace(href(path)),
  }), [router, href]);
}
