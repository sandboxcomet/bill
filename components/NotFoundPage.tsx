"use client";
import { useI18n } from "./LanguageProvider";
import Link from "./LocalizedLink";

export default function NotFoundPage() {
  const { t } = useI18n();
  return <section id="content" className="not-found-page" aria-labelledby="not-found-title">
    <div className="share-receipt not-found-receipt">
      <h1 id="not-found-title" className="not-found-title">
        <span className="not-found-code">404</span>
        {t("notFound.title")}
      </h1>
      <p className="not-found-description">{t("notFound.description")}</p>
      <div className="not-found-actions">
        <Link className="button primary" href="/bills">{t("notFound.myBills")}</Link>
        <Link className="button secondary" href="/">{t("nav.backHome")}</Link>
      </div>
    </div>
  </section>;
}
