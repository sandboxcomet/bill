"use client";
import { useEffect, useRef } from "react";
import { locales } from "@/lib/locale";
import { useI18n } from "./LanguageProvider";
import { Icon } from "./Icons";

export function LanguageOptions({ onSelect }: { onSelect: () => void }) {
  const { locale, setLocale, t } = useI18n();
  return <div className="language-options" role="group" aria-label={t("nav.language")}>
    <p>{t("nav.language")}</p>
    {locales.map((language) => <button type="button" key={language}
      lang={language} aria-pressed={locale === language}
      onClick={() => {
        onSelect();
        if (language === locale) return;
        setLocale(language);
      }}>
      <span>{language === "th" ? "ไทย" : "English"}</span>
      {locale === language && <Icon name="check" size={16} />}
    </button>)}
  </div>;
}
export default function LanguageMenu() {
  const { locale, t } = useI18n();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    // Safari can blur the summary without focusing the clicked option.
    // Dismiss on actual outside focus so the option's click can finish.
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, []);
  return <details ref={ref} className="user-menu language-menu" onKeyDown={(event) => {
    if (event.key === "Escape" && ref.current) {
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    }
  }}>
    <summary className="user-menu-trigger" aria-label={t("nav.chooseLanguage")}>
      <Icon name="globe" size={18} />
      <span aria-hidden="true">{locale.toUpperCase()}</span>
    </summary>
    <div className="user-menu-panel"><LanguageOptions onSelect={() => { if (ref.current) ref.current.open = false; }} /></div>
  </details>;
}
