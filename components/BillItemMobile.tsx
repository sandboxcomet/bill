"use client";
import { useEffect, useId, useRef } from "react";
import { useI18n } from "./LanguageProvider";
import { baht } from "@/lib/client";
import { Icon } from "./Icons";
import { BillItemAdvanced, BillItemFields, BillItemPayer, BillItemSplit, BillItemTaxes } from "./BillItemSections";
import type { BillItemProps } from "./bill-item-types";
import styles from "./BillItemMobile.module.css";

export default function BillItemMobile(props: BillItemProps & { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { item, index, total, restaurants, itemPayersEnabled, locked, saving, onUpdate, onRemove, open, onOpen, onClose } = props;
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => { if (open && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [open]);
  const itemName = item.name.trim() || t("editor.untitledItem");
  return <>
    <button type="button" className={styles.item} aria-haspopup="dialog" aria-label={t("editor.editItemLabel", [index + 1, itemName])} onClick={onOpen}>
      <span className={styles.index}>{index + 1}</span><span className={styles.details}><strong>{itemName}</strong><small>{item.quantity || 0} × ฿ {baht(item.price || 0)}</small></span><b>฿ {baht(total)}</b><Icon name="edit" size={18} />
    </button>
    {open && <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={onClose}>
      <div className={styles.header}><h2 id={title}>{t("editor.editItemHeading", [index + 1])}</h2><button type="button" className="icon-button" aria-label={t("common.close")} autoFocus onClick={() => dialog.current?.close()}><Icon name="close" size={20} /></button></div>
      <div className={styles.body}><fieldset disabled={locked || saving}>
        <BillItemFields {...props} showRemove={false} />
        <div className={styles.split}><BillItemSplit {...props} /></div>
        {itemPayersEnabled && <div className={styles.payer}><BillItemPayer {...props} /></div>}
        <div className={styles.options}>
          <div className={styles.optionGroup}><span>{t("editor.serviceChargeAndVAT")}</span><BillItemTaxes {...props} /></div>
          {restaurants.length > 0 && <label className={`field ${styles.restaurant}`}><span>{t("editor.restaurantShort")}</span><select value={item.restaurantId ?? ""} aria-label={t("editor.itemRestaurantLabel", [index + 1, restaurants.find(r => r.id === item.restaurantId)?.name ?? t("editor.noRestaurant")])} onChange={e => onUpdate({ restaurantId: e.target.value || null })}><option value="">{t("editor.noRestaurant")}</option>{restaurants.map(restaurant => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>}
        </div>
        <BillItemAdvanced {...props} />
      </fieldset></div>
      <div className={styles.actions}><button type="button" className="button secondary" disabled={locked || saving} onClick={() => { dialog.current?.close(); onRemove(); }}>{t("editor.deleteItem")}</button><button type="button" className="button primary" onClick={() => dialog.current?.close()}>{t("common.done")}</button></div>
    </dialog>}
  </>;
}
