"use client";

import { useEffect, useId, useRef } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { Icon } from "./Icons";
import styles from "./BillRevisionDialog.module.css";

export default function LeaveBillDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className={`${styles.dialog} ${styles.small}`} aria-labelledby={titleId} aria-describedby={descriptionId} onClose={onCancel}>
    <div className={styles.header}>
      <h2 id={titleId}>{t("editor.leaveTitle")}</h2>
      <button type="button" className="icon-button" aria-label={t("common.close")} onClick={() => dialog.current?.close()}><Icon name="close" size={20} /></button>
    </div>
    <div className={styles.body}>
      <p id={descriptionId} className={styles.leaveMessage}>{t("editor.leaveMessage")}</p>
    </div>
    <div className={styles.footer}>
      <button type="button" className="button secondary" autoFocus onClick={() => dialog.current?.close()}>{t("editor.stayOnBill")}</button>
      <button type="button" className="button primary" onClick={() => { dialog.current?.close(); onConfirm(); }}>{t("editor.leaveBill")}</button>
    </div>
  </dialog>;
}
