"use client";
import { billProgress } from "@/lib/bill-progress";
import { baht } from "@/lib/client";
import { useI18n } from "./LanguageProvider";
import { Icon } from "./Icons";

export default function TableProgress({ progress }: { progress: ReturnType<typeof billProgress> }) {
  const { t } = useI18n();
  return <section className={`table-progress${progress.complete ? " is-complete" : ""}`} aria-label={t("progress.tableStatus")}>
    {progress.complete && <div className="cleared-stamp" role="status"><Icon name="check" size={24} /><strong>{t("bill.status.settled")}</strong></div>}
    <div className="table-progress-heading">
      <h2>{t("progress.tableStatus")}</h2>
      {progress.complete && <span><Icon name="check" size={16} />{t("progress.allSettled")}</span>}
    </div>
    <div className="table-progress-summary" aria-live="polite" aria-atomic="true">
      <span>{t("progress.peopleSettled", [progress.paidCount, progress.totalPeople])}</span>
      <strong>{t("progress.remaining", [baht(progress.remaining)])}</strong>
    </div>
    <progress max={progress.totalPeople || 1} value={progress.paidCount}
      aria-label={t("progress.accessibleLabel")}
      aria-valuetext={t("progress.peopleSettled", [progress.paidCount, progress.totalPeople])} />
    {progress.noPaymentCount > 0 && <p>{t("progress.noPaymentCount", [progress.noPaymentCount])}</p>}
  </section>;
}
