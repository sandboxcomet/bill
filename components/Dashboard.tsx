"use client";
import { useMemo, useState } from "react";
import { nameInitial } from "@/lib/name-initial";
import { useI18n } from "@/components/LanguageProvider";
import { homeExample, type HomeExampleMode } from "@/lib/home-example";
import { baht } from "@/lib/client";
import Link from "@/components/LocalizedLink";
import { Icon } from "./Icons";

export default function Dashboard() {
  const { t } = useI18n();
  const [mode, setMode] = useState<HomeExampleMode>("equal");
  const [selectedId, setSelectedId] = useState("");
  const example = useMemo(() => homeExample(mode), [mode]);
  const modes = [
    { id: "equal", label: "home.modeEqual" },
    { id: "items", label: "home.modeItems" },
    { id: "payers", label: "home.modePayers" },
  ] as const;
  const selected = example.calculation.participants.find(p => p.id === selectedId);
  const personName = (id: string) => t(example.people.find(p => p.id === id)!.nameKey);
  return <div id="content" className="home-page">
    <section className="dashboard-intro">
      <div className="intro-copy">
        <h1>{t("home.everyExpense")}<br /><span>{t("home.fairlyShared")}</span></h1>
        <p>{t("home.useCases")}<br />{t("home.description")}</p>
        <div className="button-row">
          <Link href="/new" className="button primary"><Icon name="plus" />{t("bill.create")}</Link>
          <Link href="/demo" className="text-link">{t("common.tryASampleBill")}<Icon name="arrow" size={17} /></Link>
        </div>
        <div className="intro-note"><Icon name="shield" size={16} />{t("home.guestAccessHint")}</div>
        <ul className="home-capabilities">
          <li><Icon name="check" size={15} />{t("home.capabilityItems")}</li>
          <li><Icon name="check" size={15} />{t("home.capabilityPayers")}</li>
          <li><Icon name="check" size={15} />{t("home.capabilityExplain")}</li>
        </ul>
      </div>
      <div className="home-sample">
        <div className="sample-scenarios" role="group" aria-label={t("home.chooseExample")}>
          {modes.map(option => <button type="button" key={option.id} aria-pressed={mode === option.id} onClick={() => setMode(option.id)}>{t(option.label)}</button>)}
        </div>
        <p className="sr-only" role="status">{t("home.exampleChanged", [t(modes.find(option => option.id === mode)!.label), baht(example.grandTotal)])}</p>
        <div className="receipt-scene" aria-label={t("home.sampleBillSplit")}>
          <div className="receipt-paper sample-receipt">
            <div className="receipt-heading"><Icon name="receipt" size={22} /><span>{t(mode === "equal" ? "demo.weekendTrip" : "home.exampleDinner")}</span><span className="example-tag">{t("demo.sample")}</span></div>
            {example.items.map(item => <div className="receipt-line" key={item.id}>
              <div className="sample-item-copy"><span>{t(item.nameKey)}</span><small>{item.isShared ? t("common.splitWithEveryone") : item.consumers.map(personName).join(", ")}{mode === "payers" && t("home.examplePayer", [personName(item.payerId)])}</small></div>
              <b>฿ {baht(item.price)}</b>
            </div>)}
            <div className="receipt-total"><span>{t("bill.totalLabel")}</span><strong>฿ {baht(example.grandTotal)}</strong></div>
            <div className="sample-people-heading"><span>{t("bill.costs")}</span><small>{t("home.tapName")}</small></div>
            <div className="receipt-people sample-people">
              {example.calculation.participants.map((person, i) => <button key={person.id} type="button" className="sample-person" aria-expanded={selectedId === person.id} aria-controls="home-sample-calculation"
                onClick={() => setSelectedId(current => current === person.id ? "" : person.id)}>
                <span className={`avatar tone-${i}`} aria-hidden="true">{nameInitial(personName(person.id))}</span><span>{personName(person.id)}</span><b>฿ {baht(person.shareAmount)}</b><Icon name="help" size={14} />
              </button>)}
            </div>
            <div id="home-sample-calculation" className="sample-calculation" hidden={!selected}>
              {selected && <>
                <h3>{t("home.personCalculation", [personName(selected.id)])}</h3>
                <dl>{example.calculation.itemAllocations.flatMap(allocation => {
                  const share = allocation.shares.find(s => s.participantId === selected.id)!;
                  if (share.amount.isZero()) return [];
                  return [<div key={allocation.itemId}><dt>{t(example.items.find(item => item.id === allocation.itemId)!.nameKey)}</dt><dd>฿ {baht(share.amount)}</dd></div>];
                })}
                  <div className="sample-calculation-total"><dt>{t("expenses.yourTotal")}</dt><dd>฿ {baht(selected.shareAmount)}</dd></div>
                  {mode === "payers" && <div><dt>{t("bill.paidUpfront")}</dt><dd>฿ {baht(selected.paidUpfront)}</dd></div>}
                  {mode === "payers" && example.calculation.transfers.filter(transfer => transfer.fromParticipantId === selected.id || transfer.toParticipantId === selected.id).map(transfer =>
                    <div key={`${transfer.fromParticipantId}:${transfer.toParticipantId}`}><dt>{t(transfer.fromParticipantId === selected.id ? "home.examplePayTo" : "home.exampleReceiveFrom", [personName(transfer.fromParticipantId === selected.id ? transfer.toParticipantId : transfer.fromParticipantId)])}</dt><dd>฿ {baht(transfer.amount)}</dd></div>)}
                </dl>
              </>}
            </div>
            <div className="receipt-end"><Icon name="check" size={15} />{t("home.everyBahtAccountedFor")}</div>
          </div>
          <p className="scene-label">{t(mode === "equal" ? "home.oneBillSplitByItem" : mode === "items" ? "home.itemsExampleHint" : "home.payersExampleHint")}</p>
        </div>
      </div>
    </section>
    <section className="home-walkthrough" aria-labelledby="home-walkthrough-title">
      <div className="home-walkthrough-intro"><h2 id="home-walkthrough-title">{t("home.walkthroughTitle")}</h2><p>{t("home.walkthroughIntro")}</p><Link className="text-link" href="/demo">{t("home.tryItYourself")}<Icon name="arrow" size={17} /></Link></div>
      <ol className="home-steps">
        <li><h3>{t("home.stepCreateTitle")}</h3><p>{t("home.stepCreateBody")}</p></li>
        <li><h3>{t("home.stepShareTitle")}</h3><p>{t("home.stepShareBody")}</p></li>
        <li><h3>{t("home.stepSettleTitle")}</h3><p>{t("home.stepSettleBody")}</p></li>
      </ol>
    </section>
  </div>;
}
