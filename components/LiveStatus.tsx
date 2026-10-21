"use client";
import { useI18n } from "./LanguageProvider";
export default function LiveStatus({ status }: { status: "live" | "reconnecting" }) {
  const { t } = useI18n();
  return <span className={`live-status${status === "reconnecting" ? " is-reconnecting" : ""}`} role="status">
    <span className="live-status-dot" aria-hidden="true" />
    {t(status === "live" ? "live.automatic" : "live.reconnecting")}
  </span>;
}
