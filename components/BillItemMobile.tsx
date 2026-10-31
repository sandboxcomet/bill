"use client";
import { useEffect, useId, useRef } from "react";
import { useI18n } from "./LanguageProvider";
import { baht } from "@/lib/client";
import { Icon } from "./Icons";
import { BillItemAdvanced, BillItemFields, BillItemPayer, BillItemSplit, BillItemTaxes } from "./BillItemSections";
import RestaurantPicker from "./RestaurantPicker";
import type { BillItemProps } from "./bill-item-types";
import styles from "./BillItemMobile.module.css";

export default function BillItemMobile(props: BillItemProps & { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { item, index, total, participants, restaurants, itemPayersEnabled, locked, saving, onUpdate, onRemove, open, onOpen, onClose } = props;
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const summaryId = useId();
  useEffect(() => { if (open && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [open]);
  const itemName = item.name.trim() || t("editor.untitledItem");
  const customShares = item.consumerQuantities && Object.values(item.consumerQuantities).some(quantity => quantity > 0);
  const consumers = participants.filter(person => customShares
    ? (item.consumerQuantities?.[person.id] ?? 0) > 0
    : item.isShared || item.consumers.includes(person.id));
  const splitSummary = consumers.length === 0 ? t("editor.noItemConsumers")
    : consumers.length === participants.length ? t("common.splitWithEveryone")
      : t("bill.splitWith", [consumers.map(person => person.name).join(", ")]);
  const payer = participants.find(person => person.id === item.payerId);
  return <>
    <button type="button" className={styles.item} aria-haspopup="dialog" aria-label={t("editor.editItemLabel", [index + 1, itemName])} aria-describedby={summaryId} onClick={onOpen}>
      <span className={styles.index}>{index + 1}</span><span className={styles.details}><strong>{itemName}</strong><small>{item.quantity || 0} × ฿ {baht(item.price || 0)}</small></span><b>฿ {baht(total)}</b><Icon name="edit" size={18} />
      <span id={summaryId} className={styles.summary}>
        <span>{splitSummary}</span>
        {itemPayersEnabled && <span>{payer ? t("expenses.paidBy", [payer.name]) : t("common.chooseWhoPaid")}</span>}
        {(item.includeSC || item.includeVat) && <span className={styles.charges}>
          {item.includeSC && <span>SC</span>}{item.includeVat && <span>VAT</span>}
        </span>}
      </span>
    </button>
    {open && <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={onClose}>
      <div className={styles.header}><h2 id={title}>{t("editor.editItemHeading", [index + 1])}</h2><button type="button" className="icon-button" aria-label={t("common.close")} autoFocus onClick={() => dialog.current?.close()}><Icon name="close" size={20} /></button></div>
      <div className={styles.body}><fieldset disabled={locked || saving}>
        <BillItemFields {...props} showRemove={false} />
        <div className={styles.split}><BillItemSplit {...props} /></div>
        {itemPayersEnabled && <div className={styles.payer}><BillItemPayer {...props} /></div>}
        <div className={styles.options}>
          <div className={styles.optionGroup}><span>{t("editor.serviceChargeAndVAT")}</span><BillItemTaxes {...props} /></div>
          {restaurants.length > 0 && <RestaurantPicker mobile restaurants={restaurants} value={item.restaurantId} index={index} disabled={locked || saving} onChange={restaurantId => onUpdate({ restaurantId })} />}
        </div>
        <BillItemAdvanced {...props} />
      </fieldset></div>
      <div className={styles.actions}><button type="button" className="button secondary" disabled={locked || saving} onClick={() => { dialog.current?.close(); onRemove(); }}>{t("editor.deleteItem")}</button><button type="button" className="button primary" onClick={() => dialog.current?.close()}>{t("common.done")}</button></div>
    </dialog>}
  </>;
}
