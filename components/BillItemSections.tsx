"use client";
import { useI18n } from "./LanguageProvider";
import { baht } from "@/lib/client";
import { Icon } from "./Icons";
import ItemPayer from "./ItemPayer";
import PartsHelp from "./PartsHelp";
import type { BillItemProps } from "./bill-item-types";

export function BillItemFields({ item, index, total, onUpdate, onRemove, showRemove }: BillItemProps & { showRemove: boolean }) {
  const { t } = useI18n();
  return <div className="item-fields">
    <label className="field item-name"><span>{t("bill.item")}</span><input aria-label={t("editor.itemNameLabel", [index + 1])} maxLength={191} placeholder={t("editor.itemNamePlaceholder")} value={item.name} onChange={e => onUpdate({ name: e.target.value }, false)} /></label>
    <label className="field item-price"><span>{t("editor.price")}</span><input type="number" inputMode="decimal" min="0" step="0.01" value={item.price} placeholder="0.00" aria-label={t("editor.itemPriceLabel", [index + 1])} onChange={e => onUpdate({ price: e.target.value }, false)} /></label>
    <label className="field item-quantity"><span>{t("bill.quantity")}</span><input type="number" inputMode="numeric" min="1" max="999" value={item.quantity || ""} aria-label={t("editor.itemQuantityLabel", [index + 1])} onChange={e => onUpdate({ quantity: Number(e.target.value) }, false)} /></label>
    <div className="field item-net"><span>{t("editor.itemTotal")}</span><strong>฿ {baht(total)}</strong></div>
    {showRemove && <button type="button" className="icon-button remove-item" aria-label={t("editor.removeItem", [index + 1])} onClick={onRemove}><Icon name="close" size={17} /></button>}
  </div>;
}

export function BillItemSplit({ item, index, participants, allSelected, onUpdate, onToggleParticipant }: BillItemProps) {
  const { t } = useI18n();
  return <div className="item-allocation" role="group" aria-label={t("editor.itemParticipantsLabel", [index + 1])}>
    <button type="button" className="allocation-all" aria-pressed={allSelected} onClick={() => onUpdate({ isShared: !allSelected, consumerQuantities: undefined, consumers: [] })}>{t(allSelected ? "common.splitWithEveryone" : "editor.splitWithWhom")}</button>
    <div className="allocation-chips">{participants.length ? participants.map(person => <button type="button" className="allocation-chip" aria-pressed={item.isShared || item.consumers.includes(person.id)} key={person.id} onClick={() => onToggleParticipant(person.id)}>{person.name}</button>) : <span className="field-hint">{t("editor.addFriendsToSelectParticipants")}</span>}</div>
  </div>;
}

export function BillItemTaxes({ item, index, onUpdate }: BillItemProps) {
  const { t } = useI18n();
  return <div className="item-tax-toggles" role="group" aria-label={t("editor.itemChargesLabel", [index + 1])}>
    <button type="button" className="allocation-chip" aria-pressed={item.includeSC} aria-label={t("editor.itemServiceChargeLabel", [index + 1])} onClick={() => onUpdate({ includeSC: !item.includeSC })}>Service charge</button>
    <button type="button" className="allocation-chip" aria-pressed={item.includeVat} aria-label={t("editor.itemVatLabel", [index + 1])} onClick={() => onUpdate({ includeVat: !item.includeVat })}>VAT</button>
  </div>;
}

export function BillItemPayer({ item, index, payerCandidates, onUpdate, onPromptPay }: BillItemProps) {
  return <ItemPayer people={payerCandidates} payerId={item.payerId} index={index} onSelect={payerId => onUpdate({ payerId })} onPromptPay={onPromptPay} />;
}

export function BillItemAdvanced({ item, index, participants, onUpdate, onUpdateParts }: BillItemProps) {
  const { t } = useI18n();
  return <details className="item-details"><summary>{t("editor.discountAndSplitOptions")}</summary>
    <div className="details-fields"><label className="field discount-field"><span>{t("bill.discount")}</span><span className="number-field"><input type="text" inputMode="decimal" maxLength={6} autoComplete="off" aria-label={t("editor.itemDiscountLabel", [index + 1])} value={item.discountRate} onChange={e => { const value = e.target.value; if (/^\d{0,3}(?:\.\d{0,2})?$/.test(value) && (value === "." || Number(value) <= 100)) onUpdate({ discountRate: value }, false); }} /><span className="number-unit" aria-hidden="true">%</span></span></label></div>
    {participants.length > 0 && <div className="custom-quantities"><PartsHelp id={item.id} /><p id={`parts-help-${item.id}`} className="field-hint">{Object.keys(item.consumerQuantities ?? {}).length ? t("editor.excludedPersonHint") : t("editor.equalSplitHint")}</p><div className="parts-fields">{participants.map(person => <label className="field" key={person.id}><span>{person.name}</span><span className="number-field"><input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" aria-label={t("editor.personSharesLabel", [person.name, index + 1])} aria-describedby={`parts-help-${item.id}`} value={item.consumerQuantities?.[person.id] || ""} onChange={e => onUpdateParts(person.id, e.target.value)} /><span className="number-unit" aria-hidden="true">{t("editor.shares")}</span></span></label>)}</div></div>}
  </details>;
}
