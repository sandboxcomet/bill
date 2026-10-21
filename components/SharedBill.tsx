"use client";
import { useI18n } from "@/components/LanguageProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/LocalizedLink";
import { useLocalizedRouter } from "@/components/LanguageProvider";
import { useSession } from "next-auth/react";
import Decimal from "decimal.js";
import { baht } from "@/lib/client";
import { Icon } from "./Icons";
import PinInput from "./PinInput";
import { isBillPin } from "@/lib/pin";
import { billProgress } from "@/lib/bill-progress";
import TableProgress from "./TableProgress";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import LiveStatus from "./LiveStatus";
import ShareReceiptImage from "./ShareReceiptImage";
import AmountExplanation from "./AmountExplanation";
import { personBalance } from "@/lib/bill-view";
type Bill = {
  id: string;
  name: string;
  userId: number;
  grandTotal: string;
  itemPayersEnabled: boolean;
  serviceCharge: string;
  vat: string;
  status: string;
  createdAt: string;
  isPublic: boolean;
  owner: { name: string | null };
  participants: {
    id: string;
    name: string;
    totalPayable: string;
    shareAmount: string;
    paidUpfront: string;
    paidAmount: string;
    isPaid: boolean;
    isPayer: boolean;
    slipStatus?: { needsReview: boolean; bankPending: boolean };
    paymentUrl: string;
    paymentToken: string;
  }[];
  settlements: { id: string; fromParticipantId: string; toParticipantId: string; amount: string; paidAmount: string; isPaid: boolean }[];
  items: {
    id: string;
    name: string;
    price: string;
    quantity: number;
    discountRate: string;
    isShared: boolean;
    includeSc: boolean;
    includeVat: boolean;
    payer: { id: string; name: string } | null;
    consumers: { id: string; name: string }[];
    consumerQuantities: Record<string, number> | null;
  }[];
};
export default function SharedBill({ id }: { id: string }) {
  const { t, formatLocale, feedback } = useI18n();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const { data: session } = useSession();
  const router = useLocalizedRouter();
  const accessPin = useRef("");
  const load = useCallback(
    async (passcode = "") => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/bill?id=${encodeURIComponent(id)}`, {
          headers: { "x-bill-passcode": passcode },
          cache: "no-store",
        });
        const d = await r.json();
        if (r.status === 403) {
          setPinRequired(true);
          if (passcode) setError(t("errors.pinIncorrect"));
        } else if (!r.ok) {
          throw new Error(
            r.status === 404
              ? t("errors.billNotFoundOrUnshared")
              : d.error || t("errors.billLoadFailed"),
          );
        } else {
          accessPin.current = passcode;
          setBill(d.bill);
          setPinRequired(false);
          if (passcode)
            try {
              sessionStorage.setItem(
                `pin:${id}`,
                JSON.stringify({ pin: passcode, expires: Date.now() + 600000 }),
              );
            } catch {}
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    let cached = "";
    try {
      const raw = JSON.parse(sessionStorage.getItem(`pin:${id}`) || "null");
      if (raw?.expires > Date.now() && isBillPin(raw.pin)) cached = raw.pin;
    } catch {}
    void load(cached);
  }, [id, load]);
  const refresh = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/bill?id=${encodeURIComponent(id)}`, {
      headers: { "x-bill-passcode": accessPin.current }, cache: "no-store", signal,
    });
    const result = await response.json();
    if (signal.aborted) return;
    if (response.status === 403) { setPinRequired(true); return; }
    if (response.status === 401 || response.status === 404) {
      setBill(null);
      setError("ไม่พบบิล หรือบิลนี้ยังไม่ได้เปิดแชร์");
      return;
    }
    if (!response.ok) throw new Error("Refresh failed");
    setBill(result.bill);
  }, [id]);
  const liveStatus = useLiveRefresh(refresh, Boolean(bill?.status === "PUBLISHED" && !loading && !pinRequired && !sharing));
  async function share() {
    setSharing(true);
    setMessage("");
    try {
      if (navigator.share) {
        await navigator.share({
          title: bill?.name || t("bill.ourBill"),
          text: t("share.linkDescription"),
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage(t("share.linkCopied"));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessage(t("share.copyLinkFallback", [window.location.href]));
    } finally {
      setSharing(false);
    }
  }
  function pay(p: Bill["participants"][number]) {
    setError("");
    try {
      sessionStorage.setItem(`payment:${id}:${p.id}`, p.paymentToken);
      router.push(p.paymentUrl);
    } catch {
      setError(
        t("errors.paymentStorageUnavailable"),
      );
    }
  }
  if (loading)
    return (
      <div id="content" className="empty-state" role="status">
        <span className="spinner" /> {t("common.openingBill")} </div>
    );
  if (pinRequired)
    return (
      <form
        id="content"
        className="panel pin-gate"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isBillPin(pin)) {
            setError(t("errors.pinIncomplete"));
            return;
          }
          void load(pin);
        }}
      >
        <Icon name="shield" size={36} />
        <h1>{t("bill.pinRequired")}</h1>
        <p>{t("bill.pinHint")}</p>
        <PinInput
          value={pin}
          onChange={(value) => {
            setPin(value);
            setError("");
          }}
          autoFocus
          required
          invalid={error.includes("PIN")}
          describedBy={error ? "shared-pin-error" : undefined}
        />
        {error && (
          <p id="shared-pin-error" className="error" role="alert">
            {feedback(error)}
          </p>
        )}
        <button className="button primary full-width"> {t("bill.openBill")} <Icon name="arrow" size={17} />
        </button>
      </form>
    );
  if (!bill)
    return (
      <div id="content" className="empty-state">
        <Icon name="receipt" size={36} />
        <h1>{t("errors.billOpenFailed")}</h1>
        <p className="error" role="alert">
          {feedback(error) || t("errors.billNotFound")}
        </p>
        <button className="button secondary" onClick={() => load()}> {t("bill.tryOpeningAgain")} </button>
        <Link href="/" className="text-link"> {t("nav.backHome")} </Link>
      </div>
    );
  const owner = String(session?.user?.id) === String(bill.userId);
  const cancelled = bill.status === "CANCELLED";
  const progress = billProgress(bill);
  return (
    <div id="content" className="share-layout">
      <div className="share-toolbar">
      {session?.user && <Link href="/bills" className="text-link muted">
        <Icon name="back" size={16} /> {t("nav.backToBills")} </Link>}
      <div className="share-actions">
        {!cancelled && bill.status === "PUBLISHED" && (
          <button className="button share-link-button" disabled={sharing} onClick={share}>
            <Icon name="link" size={16} /> {t("share.link")} </button>
        )}
        {!cancelled && bill.status === "PUBLISHED" && <ShareReceiptImage data={() => ({
          name: bill.name || t("bill.ourBill"), total: bill.grandTotal,
          date: new Date(bill.createdAt).toLocaleDateString(formatLocale, { day: "numeric", month: "long", year: "numeric" }),
          url: `${window.location.origin}/bill/${encodeURIComponent(bill.id)}`,
          complete: progress.complete, privateBill: !bill.isPublic,
          people: bill.participants.map(p => {
            const balance = personBalance(p, bill.settlements, bill.itemPayersEnabled);
            return { name: p.name, costs: bill.itemPayersEnabled ? p.shareAmount : p.totalPayable,
              due: balance.due.toString(), receive: balance.receive.toString() };
          }),
        })} />}
        {owner && <button className="button share-link-button" onClick={() => router.push(`/new?repeat=${encodeURIComponent(id)}&round=${crypto.randomUUID()}`)}><Icon name="copy" size={16} />{t("bill.repeatGroup")}</button>}
        {owner && !cancelled && (
          <Link className="button secondary" href={`/bills/${id}/edit`}> {t("bill.edit")} </Link>
        )}
      </div>
      </div>
      {cancelled && (
        <div className="warning"> {t("errors.billCancelled")} </div>
      )}
      {bill.status === "DRAFT" && (
        <div className="notice"> {t("bill.draftNotice")} </div>
      )}
      {message && (
        <p role="status" className="success">
          {feedback(message)}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {feedback(error)}
        </p>
      )}
      <section className="share-receipt">
        <div className="receipt-brand" lang="th">เคลียร์โต๊ะ <span lang="en">Clear Toh</span></div>
        <div className="share-title">
          <h1>{bill.name || t("bill.ourBill")}</h1>
          <p>
            {new Date(bill.createdAt).toLocaleDateString(formatLocale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "} {t("bill.createdByNote")} {bill.owner.name || t("bill.creator")}
          </p>
          {bill.status === "PUBLISHED" && <LiveStatus status={liveStatus} />}
        </div>
        {bill.status === "PUBLISHED" && bill.participants.length > 0 && <TableProgress progress={progress} />}
        <div className="share-items">
          <div className="receipt-items-heading"><h2>{t("bill.itemsHeading")} {bill.items.length}</h2><span>{t("common.baht")}</span></div>
          {bill.items.map((i) => (
            <div className="share-item-line" key={i.id}>
              <div>
                {i.name} × {i.quantity}
                <small>
                  {i.isShared
                    ? t("common.splitWithEveryone")
                    : i.consumers.map((p) => p.name).join(", ")}
                  {Number(i.discountRate) > 0 ? t("expenses.discountNote", [i.discountRate]) : ""}
                  {bill.itemPayersEnabled && i.payer ? t("expenses.payerNote", [i.payer.name]) : ""}
                </small>
              </div>
              <b>
                {baht(
                  new Decimal(i.price)
                    .mul(i.quantity)
                    .mul(
                      new Decimal(1).minus(
                        new Decimal(i.discountRate).div(100),
                      ),
                    ),
                )}
              </b>
            </div>
          ))}
          {!new Decimal(bill.serviceCharge).isZero() && <div className="share-item-line">
            <span>Service charge</span>
            <b>{baht(bill.serviceCharge)}</b>
          </div>}
          {!new Decimal(bill.vat).isZero() && <div className="share-item-line">
            <span>VAT</span>
            <b>{baht(bill.vat)}</b>
          </div>}
        </div>
        <div className="share-total">
          <span>{t("bill.total")}</span>
          <strong>฿ {baht(bill.grandTotal)}</strong>
        </div>
        <div className="panel-heading receipt-people-heading">
          <h2>{t("bill.individualTotals")}</h2>
          <Icon name="users" size={19} />
        </div>
        {bill.participants.map((p) => {
          const received = bill.settlements.filter((s) => s.toParticipantId === p.id);
          const incoming = received
            .reduce((sum, s) => sum.plus(s.amount), new Decimal(0));
          const { due: outgoingRemaining, receive: incomingRemaining } = personBalance(p, bill.settlements, bill.itemPayersEnabled);
          const canOpen = !cancelled && bill.status === "PUBLISHED";
          return <div className={`participant-row${canOpen ? " is-interactive" : ""}`} key={p.id}>
            <div className="participant-info">
              <div className="participant-name-line">
                <h3>{p.name}</h3>
                {p.isPaid && Number(p.totalPayable) > 0 && <span className="participant-paid-label"><Icon name="check" size={13} />{t("common.fullyPaid")}</span>}
              </div>
              {bill.itemPayersEnabled ? <dl className="receipt-person-meta">
                <div><dt>{t("bill.costs")}</dt><dd>{baht(p.shareAmount)}</dd></div>
                {new Decimal(p.paidUpfront).gt(0) && <div><dt>{t("bill.paidUpfront")}</dt><dd>{baht(p.paidUpfront)}</dd></div>}
              </dl> : <p>{p.isPaid ? t("payment.confirmed") : t("payment.awaitingPayment")}</p>}
              {p.slipStatus?.needsReview && <p className="participant-slip-status">{t("payment.uploadedAwaitingReview")}</p>}
              {p.slipStatus?.bankPending && <p className="participant-slip-status">{t("payment.uploadedAwaitingBank")}</p>}
            </div>
            <div className="participant-payment">
            <div className="participant-amount">
              {canOpen ? <AmountExplanation billId={id} participantId={p.id} name={p.name} token={p.paymentToken}>

              {bill.itemPayersEnabled ? <>
                {Number(p.totalPayable) > 0 && <span className="participant-balance-line"><span>{outgoingRemaining.isZero() ? t("payment.confirmed") : t("payment.toPay")}</span><b>฿ {baht(outgoingRemaining.isZero() ? p.totalPayable : outgoingRemaining)}</b></span>}
                {incoming.gt(0) && <span className="participant-balance-line participant-credit"><span>{incomingRemaining.isZero() ? t("payment.received") : t("payment.toReceive")}</span><b>฿ {baht(incomingRemaining.isZero() ? incoming : incomingRemaining)}</b></span>}
                {Number(p.totalPayable) === 0 && incoming.isZero() && t("payment.balanced")}
              </> : <b>฿ {baht(outgoingRemaining)}</b>}
              </AmountExplanation> : <>

              {bill.itemPayersEnabled ? <>
                {Number(p.totalPayable) > 0 && <span className="participant-balance-line"><span>{outgoingRemaining.isZero() ? t("payment.confirmed") : t("payment.toPay")}</span><b>฿ {baht(outgoingRemaining.isZero() ? p.totalPayable : outgoingRemaining)}</b></span>}
                {incoming.gt(0) && <span className="participant-balance-line participant-credit"><span>{incomingRemaining.isZero() ? t("payment.received") : t("payment.toReceive")}</span><b>฿ {baht(incomingRemaining.isZero() ? incoming : incomingRemaining)}</b></span>}
                {Number(p.totalPayable) === 0 && incoming.isZero() && t("payment.balanced")}
              </> : <b>฿ {baht(outgoingRemaining)}</b>}
              </>}
            </div>
            {canOpen && (
              <button
                className="button secondary participant-pay-button"
                aria-label={t("payment.viewPerson", [p.name])}
                onClick={() => pay(p)}
              >
                {p.isPaid ? (
                  <Icon name="check" size={15} />
                ) : (
                  <Icon name={Number(p.totalPayable) > 0 ? "wallet" : "arrow"} size={15} />
                )}{" "}
                {p.isPaid || Number(p.totalPayable) === 0 ? t("payment.view") : t("payment.viewAndPay")}
              </button>
            )}
            </div>
          </div>;
        })}
        <p className="receipt-end">{bill.participants.length} {t("bill.peopleFooter")}</p>
        <p className="summary-footnote">
          <Icon name="shield" size={12} />{" "} {t("bill.slipPrivacyNotice")} </p>
      </section>
    </div>
  );
}
