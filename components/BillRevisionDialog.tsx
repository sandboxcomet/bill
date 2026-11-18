"use client";

import { useEffect, useId, useRef } from "react";
import Decimal from "decimal.js";
import { useI18n } from "@/components/LanguageProvider";
import { baht } from "@/lib/client";
import { Icon } from "./Icons";
import styles from "./BillRevisionDialog.module.css";

export type RevisionReviewRow = {
  from: string; to: string; owed: string; paid: string; remaining: string; refundDue: string;
};

export default function BillRevisionDialog({ rows, onCancel, onConfirm }: {
  rows: RevisionReviewRow[]; onCancel: () => void; onConfirm: () => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  const refundTotal = rows.reduce((sum, row) => sum.plus(row.refundDue), new Decimal(0));
  const remainingTotal = rows.reduce((sum, row) => sum.plus(row.remaining), new Decimal(0));
  const ordered = [...rows].sort((a, b) => {
    const priority = (row: RevisionReviewRow) => new Decimal(row.refundDue).gt(0) ? 0 : new Decimal(row.remaining).gt(0) ? 1 : 2;
    return priority(a) - priority(b);
  });
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={onCancel}>
    <div className={styles.header}>
      <div><p className={styles.eyebrow}>{t("editor.revisionReviewEyebrow")}</p><h2 id={titleId}>{t("editor.revisionReviewTitle")}</h2></div>
      <button type="button" className="icon-button" aria-label={t("common.close")} onClick={() => dialog.current?.close()}><Icon name="close" size={20} /></button>
    </div>
    <div className={styles.body}>
      <p className={styles.intro}>{t("editor.revisionReviewIntro")}</p>
      <div className={styles.totals}>
        <div><span>{t("editor.revisionTotalRefund")}</span><strong>฿ {baht(refundTotal)}</strong></div>
        <div><span>{t("editor.revisionTotalRemaining")}</span><strong>฿ {baht(remainingTotal)}</strong></div>
      </div>
      <h3 className={styles.sectionHeading}>{t("editor.revisionByPerson")}</h3>
      <div className={styles.rows}>
        {ordered.map((row, index) => {
          const refund = new Decimal(row.refundDue).gt(0);
          const outstanding = new Decimal(row.remaining).gt(0);
          const noPayment = new Decimal(row.owed).isZero() && new Decimal(row.paid).isZero();
          return <section className={styles.row} key={`${row.from}-${row.to}-${index}`}>
            <div className={styles.rowHeading}>
              <div className={styles.names}><strong>{row.from}</strong><span aria-hidden="true">→</span><span className={styles.recipient}>{row.to}</span></div>
              <span className={`${styles.status} ${refund ? styles.refund : outstanding || noPayment ? styles.outstanding : styles.settled}`}>{t(refund ? "editor.revisionRefundStatus" : outstanding ? "editor.revisionOutstandingStatus" : noPayment ? "editor.revisionNoPayment" : "editor.revisionSettledStatus")}</span>
            </div>
            <dl className={styles.amounts}>
              <div><dt>{t("editor.revisionOwed")}</dt><dd>฿ {baht(row.owed)}</dd></div>
              <div><dt>{t("editor.revisionPaid")}</dt><dd>฿ {baht(row.paid)}</dd></div>
              {(refund || outstanding) && <div className={refund ? styles.refundAmount : styles.outstandingAmount}>
                <dt>{t(refund ? "editor.revisionRefund" : "editor.revisionRemaining")}</dt>
                <dd>฿ {baht(refund ? row.refundDue : row.remaining)}</dd>
              </div>}
            </dl>
            {refund && <p className={styles.refundDirection}>{t("editor.revisionRefundDirection", [row.to, row.from])}</p>}
          </section>;
        })}
      </div>
      <p className={styles.notice}><Icon name="shield" size={17} /><span>{t("editor.revisionQrWarning")}</span></p>
    </div>
    <div className={styles.footer}>
      <button type="button" className="button secondary" autoFocus onClick={() => dialog.current?.close()}>{t("common.cancel")}</button>
      <button type="button" className="button primary" onClick={() => { dialog.current?.close(); onConfirm(); }}>{t("editor.revisionConfirmSave")}</button>
    </div>
  </dialog>;
}
