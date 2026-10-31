"use client";
import { useEffect, useId, useRef, useState } from "react";
import Decimal from "decimal.js";
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
  const [showErrors, setShowErrors] = useState(false);
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
  const payerSuffix = itemPayersEnabled ? (payer ? t("editor.itemPayerSuffix", [payer.name]) : t("common.chooseWhoPaid")) : null;
  let validPrice = false;
  try {
    const price = new Decimal(item.price);
    validPrice = /^\d+(\.\d{1,2})?$/.test(item.price) && price.isFinite() && !price.isNegative() && price.lte("999999999999.99") && price.decimalPlaces() <= 2;
  } catch { /* Empty or invalid price. */ }
  const hasConsumers = item.consumerQuantities
    ? participants.some(person => (item.consumerQuantities?.[person.id] ?? 0) > 0)
    : participants.some(person => item.isShared || item.consumers.includes(person.id));
  const validationErrors = [
    !item.name.trim() && t("editor.itemNameRequired"),
    !validPrice && t("editor.itemPriceRequired"),
    (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) && t("editor.itemQuantityRequired"),
    !hasConsumers && t("editor.itemConsumersRequired"),
    itemPayersEnabled && !payer && t("editor.itemPayerRequired"),
  ].filter((message): message is string => Boolean(message));
  function saveItem() {
    if (!locked && validationErrors.length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (!locked) onUpdate({}, true);
    dialog.current?.close();
  }
  return <>
    <button type="button" className={styles.item} aria-haspopup="dialog" aria-label={t("editor.editItemLabel", [index + 1, payerSuffix ? `${itemName} (${payerSuffix})` : itemName])} aria-describedby={summaryId} onClick={onOpen}>
      <span className={styles.index}>{index + 1}</span><span className={styles.details}><strong>{itemName}{payerSuffix && <span className={styles.payerSuffix}> ({payerSuffix})</span>}</strong></span><b>฿ {baht(total)}</b><Icon name="edit" size={18} />
      <span id={summaryId} className={styles.summary}>
        <span>{item.quantity || 0} × ฿ {baht(item.price || 0)}</span>
        <span className={styles.summaryRight}>
          <span>{splitSummary}</span>
          {(item.includeSC || item.includeVat) && <span className={styles.charges}>
            {item.includeSC && <span>SC</span>}{item.includeVat && <span>VAT</span>}
          </span>}
        </span>
      </span>
    </button>
    {open && <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={() => { setShowErrors(false); onClose(); }}>
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
      <div className={styles.footer}>
        {showErrors && validationErrors.length > 0 && <div className={styles.validation} role="alert"><strong>{t("editor.itemMissingFields")}</strong><ul>{validationErrors.map(message => <li key={message}>{message}</li>)}</ul></div>}
        <div className={styles.actions}><button type="button" className="button secondary" disabled={locked || saving} onClick={() => { dialog.current?.close(); onRemove(); }}>{t("editor.deleteItem")}</button><button type="button" className="button primary" disabled={saving} onClick={saveItem}>{t(locked ? "common.close" : "common.save")}</button></div>
      </div>
    </dialog>}
  </>;
}
