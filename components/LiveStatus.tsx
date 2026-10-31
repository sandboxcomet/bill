"use client";
import { useI18n } from "./LanguageProvider";
export default function LiveStatus({ status }: { status: "live" | "reconnecting" }) {
  const { t } = useI18n();
  if (status === "live") return null;
  return <span className="live-status is-reconnecting" role="status">
    <span className="live-status-dot" aria-hidden="true" />
    {t("live.reconnecting")}
  </span>;
}
