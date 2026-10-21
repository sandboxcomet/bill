"use client";
import { useI18n } from "@/components/LanguageProvider";
import Decimal from "decimal.js";
import { baht } from "@/lib/client";
import type { ExpenseDetails, ExpenseRecipient } from "@/lib/expense-details";
export type { ExpenseDetails } from "@/lib/expense-details";

function Components({ base, serviceCharge, vat, rounding }: { base: string; serviceCharge: string; vat: string; rounding: string }) {
  const { t } = useI18n();
  return <dl className="expense-components">
    <div><dt>{t("explanation.base")}</dt><dd>฿ {baht(base)}</dd></div>
    {new Decimal(serviceCharge).gt(0) && <div><dt>{t("explanation.serviceCharge")}</dt><dd>฿ {baht(serviceCharge)}</dd></div>}
    {new Decimal(vat).gt(0) && <div><dt>{t("explanation.vat")}</dt><dd>฿ {baht(vat)}</dd></div>}
    {!new Decimal(rounding).isZero() && <div><dt>{t("explanation.rounding")}</dt><dd>฿ {baht(rounding)}</dd></div>}
  </dl>;
}
export default function ExpenseBreakdown({ details, recipient, initiallyOpen = false }: {
  details?: ExpenseDetails | null; recipient?: ExpenseRecipient; initiallyOpen?: boolean;
}) {
  const { t } = useI18n();
  if (!details) return null;
  const items = recipient ? details.items.filter(item => Boolean(recipient.recipientId) && item.payerId === recipient.recipientId && new Decimal(item.shareAmount).gt(0)) : details.items;
  const hasOffset = recipient?.offsetAmount && new Decimal(recipient.offsetAmount).gt(0);
  const net = new Decimal(details.paidUpfront).minus(details.shareTotal);
  const alreadyPaid = recipient ? Decimal.max(recipient.paidAmount ?? 0, 0) : new Decimal(0);
  return <details key={recipient?.recipientId ?? "overview"} className="panel payment-expenses" open={initiallyOpen || undefined}>
    <summary className="expense-summary">
      <span className="expense-summary-label"><strong>{recipient ? t("expenses.recipientHeading", [recipient.name]) : t("expenses.yourTotal")}</strong>
        <span className="expense-summary-closed">{t("expenses.showDetails")}</span><span className="expense-summary-open">{t("expenses.hideDetails")}</span></span>
      <b>฿ {baht(recipient?.totalPayable ?? details.shareTotal)}</b>
      <svg className="expense-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <div className="expense-content">
      {recipient && <p className="expense-reason">{t("explanation.recipientReason", [recipient.name])}</p>}
      <ul className="expense-list">{items.map(item => <li key={item.id}>
        <div className="expense-item-heading"><strong>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</strong><b>฿ {baht(item.shareAmount)}</b></div>
        <p>{t("expenses.itemTotal")} {baht(item.total)}{Number(item.discountRate) > 0 ? t("expenses.discountNote", [Number(item.discountRate)]) : ""}</p>
        <p>{details.pairwise && (item.paidByYou ? t("expenses.youPaidUpfront") : t("expenses.paidBy", [item.payerName]))}
          {item.totalParts ? t("expenses.weightNote", [item.parts, item.totalParts]) : t("expenses.splitNote", [item.consumerCount])}</p>
        {item.baseAmount !== undefined && <Components base={item.baseAmount} serviceCharge={item.serviceCharge} vat={item.vat} rounding={item.roundingAdjustment} />}
        {item.paidByYou && <p>{t("explanation.itemAdvanced", [baht(item.total)])}</p>}
      </li>)}</ul>
      {!recipient && <>
        {details.baseSubtotal !== undefined && <Components base={details.baseSubtotal} serviceCharge={details.serviceCharge} vat={details.vat} rounding={details.roundingAdjustment} />}
        <dl className="expense-totals"><div><dt>{t("expenses.yourTotal")}</dt><dd>฿ {baht(details.shareTotal)}</dd></div>
          {new Decimal(details.paidUpfront).gt(0) && <>
            <div><dt>{t("explanation.advanced")}</dt><dd>฿ {baht(details.paidUpfront)}</dd></div>
            <div><dt>{t(net.gte(0) ? "explanation.netReceive" : "explanation.netPay")}</dt><dd>฿ {baht(net.abs())}</dd></div>
          </>}
          <div><dt>{t("explanation.remainingToPay")}</dt><dd>฿ {baht(details.remainingToPay ?? details.amountToPay ?? details.shareTotal)}</dd></div>
          {new Decimal(details.amountToReceive ?? 0).gt(0) && <div><dt>{t("explanation.remainingToReceive")}</dt><dd>฿ {baht(details.remainingToReceive ?? details.amountToReceive)}</dd></div>}
        </dl>
        {details.pairwise && <p className="field-hint">{t("explanation.pairwiseHint")}</p>}
      </>}
      {recipient && <>
        {hasOffset && <section className="expense-offset"><h3>{t("explanation.offsetHeading", [recipient.name])}</h3>
          <p className="field-hint">{t("explanation.offsetReason", [recipient.name])}</p>
          <ul className="expense-list">{recipient.offsetItems?.map(item => <li key={item.id}><div className="expense-item-heading"><span>{item.name}</span><b>− ฿ {baht(item.shareAmount)}</b></div>
            <Components base={item.baseAmount} serviceCharge={item.serviceCharge} vat={item.vat} rounding={item.roundingAdjustment} /></li>)}</ul>
        </section>}
        <dl className="expense-totals expense-recipient-total">
          <div><dt>{t("explanation.grossOwed", [recipient.name])}</dt><dd>฿ {baht(recipient.beforeOffset ?? recipient.totalPayable)}</dd></div>
          {hasOffset && <div><dt>{t("expenses.reciprocalOffset", [recipient.name])}</dt><dd>− ฿ {baht(recipient.offsetAmount!)}</dd></div>}
          <div className="expense-final-total"><dt>{t("expenses.totalReimbursementTo")} {recipient.name}</dt><dd>฿ {baht(recipient.totalPayable)}</dd></div>
          {alreadyPaid.gt(0) && <><div><dt>{t("explanation.confirmedPaid")}</dt><dd>− ฿ {baht(alreadyPaid)}</dd></div>
            <div className="expense-final-total"><dt>{t("explanation.remaining")}</dt><dd>฿ {baht(Decimal.max(new Decimal(recipient.totalPayable).minus(alreadyPaid), 0))}</dd></div></>}
          {alreadyPaid.gt(recipient.totalPayable) && <div><dt>{t("explanation.overpaid")}</dt><dd>฿ {baht(alreadyPaid.minus(recipient.totalPayable))}</dd></div>}
        </dl>
        <p className="field-hint">{t("explanation.pairOnlyHint")}</p>
      </>}
      {details.includesCharges && <p className="field-hint">{t("expenses.chargesIncluded")}</p>}
    </div>
  </details>;
}
