import Decimal from "decimal.js";
import { useI18n } from "./LanguageProvider";
import { baht } from "@/lib/client";
import type { BillListItem } from "@/lib/bill-list";
import styles from "./BillsDashboard.module.css";

export default function BillsDashboard({ bills, payableBills, receivable, spending }: {
  bills: BillListItem[];
  payableBills: BillListItem[];
  receivable: { amount: string; billCount: number };
  spending: { share: string; shareBills: number; paid: string; paidBills: number };
}) {
  const { t } = useI18n();
  const payable = payableBills.reduce((sum, bill) => sum.plus(bill.payment?.remaining ?? 0), new Decimal(0));
  const drafts = bills.filter(bill => bill.status === "DRAFT").length;
  const unsettled = bills.filter(bill => bill.status === "PUBLISHED" && bill.payment && new Decimal(bill.payment.remaining).gt(0)).length;
  const review = bills.filter(bill => bill.status === "PUBLISHED" && bill.payment?.status === "REVIEW").length;
  return <section className={styles.dashboard} aria-labelledby="bills-overview-title">
    <div className={styles.heading}>
      <h2 id="bills-overview-title">{t("dashboard.title")}</h2>
      <span>{t("dashboard.sharedBillsNote")}</span>
    </div>
    <div className={styles.amounts}>
      <div><span>{t("dashboard.yourSpending")}</span><strong>฿ {baht(spending.share)}</strong><small>{t("dashboard.billCount", [spending.shareBills])}</small></div>
      <div><span>{t("dashboard.paidOut")}</span><strong>฿ {baht(spending.paid)}</strong><small>{t("dashboard.billCount", [spending.paidBills])}</small></div>
      <div><span>{t("dashboard.toPay")}</span><strong>฿ {baht(payable.toFixed(2))}</strong><small>{t("dashboard.billCount", [payableBills.length])}</small></div>
      <div><span>{t("dashboard.toReceive")}</span><strong>฿ {baht(receivable.amount)}</strong><small>{t("dashboard.billCount", [receivable.billCount])}</small></div>
    </div>
    <p className={styles.amountNote}>{t("dashboard.spendingNote")}</p>
    <div className={styles.stats}>
      <div><span>{t("dashboard.created")}</span><strong>{t("dashboard.billCount", [bills.length])}</strong></div>
      <div><span>{t("dashboard.drafts")}</span><strong>{t("dashboard.billCount", [drafts])}</strong></div>
      <div><span>{t("dashboard.unsettled")}</span><strong>{t("dashboard.billCount", [unsettled])}</strong></div>
      <div><span>{t("dashboard.review")}</span><strong>{t("dashboard.billCount", [review])}</strong><small>{t("dashboard.reviewHint")}</small></div>
    </div>
  </section>;
}
