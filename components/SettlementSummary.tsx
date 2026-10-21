"use client";
import { nameInitial } from "@/lib/name-initial";
import { useI18n } from "@/components/LanguageProvider";
import { baht } from "@/lib/client";
import type { calculateSettlements } from "@/lib/settlements";
import { Icon } from "./Icons";

export default function SettlementSummary({ people, settlement, pending }: {
  people: { id: string; name: string }[];
  settlement: ReturnType<typeof calculateSettlements>;
  pending?: string;
}) {
  const { t } = useI18n();
  const name = (id: string) => people.find((p) => p.id === id)?.name;
  return (
    <section className="net-summary" aria-label={t("bill.personTotals")}>
      <h3>{t("bill.personTotals")}</h3>
      {people.length ? <ul className="net-people">
        {people.map((person, index) => {
          const p = settlement?.participants.find((p) => p.id === person.id);
          const waiting = pending || (!p ? t("common.chooseWhoPaid") : "");
          return <li className="net-person" key={person.id}>
            <div className="net-person-heading">
              <span className={`avatar small tone-${index % 4}`} aria-hidden="true">{nameInitial(person.name)}</span>
              <strong className="net-person-name">{person.name}</strong>
              <div className="net-person-result">
                {waiting ? <span>{waiting}</span> : p && <>
                  {p.amountToPay.gt(0) && <div><span>{t("payment.toPay")}</span><b>฿ {baht(p.amountToPay)}</b></div>}
                  {p.amountToReceive.gt(0) && <div className="net-person-credit"><span>{t("payment.toReceive")}</span><b>฿ {baht(p.amountToReceive)}</b></div>}
                  {p.amountToPay.isZero() && p.amountToReceive.isZero() && <span>{t("payment.balanced")}</span>}
                </>}
              </div>
            </div>
            {!waiting && p && <dl className="net-person-details">
              <div><dt>{t("bill.costs")}</dt><dd>{baht(p.shareAmount)}</dd></div>
              <div><dt>{t("bill.paidUpfront")}</dt><dd>{baht(p.paidUpfront)}</dd></div>
            </dl>}
          </li>;
        })}
      </ul> : <p className="field-hint">{t("common.addFriendsToSeeIndividualTotals")}</p>}
      {!pending && settlement && settlement.transfers.length > 0 && (
        <div className="net-transfer-section">
          <h3>{t("common.whoReimbursesWhom")}</h3>
          <ul className="net-transfers">
            {settlement.transfers.map((transfer) => <li key={`${transfer.fromParticipantId}:${transfer.toParticipantId}`}>
              <span className="net-transfer-route">
                <span>{name(transfer.fromParticipantId)}</span>
                <span className="net-transfer-arrow"><Icon name="arrow" size={16} /><span className="sr-only">{t("common.payTo")}</span></span>
                <span>{name(transfer.toParticipantId)}</span>
              </span>
              <b>฿ {baht(transfer.amount)}</b>
            </li>)}
          </ul>
          <p className="field-hint">{t("expenses.pairwiseOffsetHint")}</p>
        </div>
      )}
    </section>
  );
}
