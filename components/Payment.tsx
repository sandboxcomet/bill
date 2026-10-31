"use client";
import { sharedBillPath, participantPaymentPath } from "@/lib/bill-paths";
import { useI18n, useLocalizedRouter } from "@/components/LanguageProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "@/components/LocalizedLink";
import BrandedQr from "./BrandedQr";
import generatePayload from "promptpay-qr";
import Decimal from "decimal.js";
import { isPendingEvidence, recipientPaymentStatus } from "@/lib/payment-status";
import { baht, request, jsonBody, RequestError } from "@/lib/client";
import { Icon } from "./Icons";
import type { ExpenseItem } from "@/lib/expense-details";
import ExpenseBreakdown, { type ExpenseDetails } from "./ExpenseBreakdown";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import LiveStatus from "./LiveStatus";
import { useBillTitle } from "@/lib/use-bill-title";
type Payable = {
  name: string;
  totalPayable: string;
  paidAmount: string;
  isPaid: boolean;
  payslipUrl: string | null;
  evidenceStatus: string | null;
  evidenceTransactedAt?: string | null;
  beforeOffset?: string | null;
  offsetAmount?: string | null;
  offsetItems?: ExpenseItem[];
};
type Data = {
  bill: {
    name: string;
    itemPayersEnabled: boolean;
    owner: { name: string | null; promptPayId: string | null };
  };
  participant: Payable;
  settlements: (Payable & { id: string; recipientId: string; promptPayId: string | null })[];
  canManage: boolean;
  requiresClaim: boolean;
  readOnly?: boolean;
  ownEntry?: { id: string; name: string; paymentUrl: string; paymentToken: string } | null;
  expenseDetails?: ExpenseDetails | null;
};
const recipientStatusLabels = { PAID: "myBills.paymentPaid", REVIEW: "myBills.paymentReview", BANK_PENDING: "payment.bankPendingShort", PARTIAL: "myBills.paymentPartial", UNPAID: "myBills.paymentUnpaid" } as const;
export default function Payment({ id, pid }: { id: string; pid: string }) {
  const { t, feedback, formatLocale } = useI18n();
  const router = useLocalizedRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<Data | null>(null);
  useBillTitle(data?.bill.name);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [checkingSlip, setCheckingSlip] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const [reason, setReason] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = data?.settlements.find((s) => s.id === selectedId);
  const proofUrl = data?.readOnly || (data?.requiresClaim && !data.canManage) ? null
    : selected?.payslipUrl ?? (!data?.bill.itemPayersEnabled ? data?.participant.payslipUrl : null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [readyQr, setReadyQr] = useState("");
  const endpoint = `/api/bills/${id}/participants/${pid}`;
  // Version the read URL so Fast Refresh also reloads pre-recipient expense data.
  const readEndpoint = `${endpoint}?expenseDetails=explanation-v2`;
  const redirectAccount = useCallback((error: unknown) => {
    if (!(error instanceof RequestError)) return false;
    const page = error.status === 401 ? "/login" : error.status === 403 &&
      ["account.usernameRequired", "account.nicknameRequired", "account.profileRequired"].includes(error.code) ? "/onboarding" : null;
    if (!page) return false;
    window.location.replace(`${page}?callbackUrl=${encodeURIComponent(participantPaymentPath(id, pid))}`);
    return true;
  }, [id, pid]);
  const headers = useCallback(() => {
    let token = "";
    try {
      token = sessionStorage.getItem(`payment:${id}:${pid}`) ?? "";
    } catch {}
    return { "x-payment-token": token };
  }, [id, pid]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await request<Data>(readEndpoint, { headers: headers(), cache: "no-store" }));
    } catch (e) {
      if (!redirectAccount(e)) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [readEndpoint, headers, redirectAccount]);
  useEffect(() => {
    setSelectedId("");
    void load();
  }, [load]);
  const refresh = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(readEndpoint, { headers: headers(), cache: "no-store", signal });
    const result = await response.json();
    if (signal.aborted) return;
    if (!response.ok && redirectAccount(new RequestError(result.error || "", response.status, result.error))) return;
    if ([401, 403, 404].includes(response.status)) {
      setData(null);
      setError(result.error || "เปิดจากหน้าบิลอีกครั้ง");
      return;
    }
    if (!response.ok) throw new Error("Refresh failed");
    setData(result);
  }, [readEndpoint, headers, redirectAccount]);
  const liveStatus = useLiveRefresh(refresh, Boolean(data && !working && !loading));
  useEffect(() => {
    const url = proofUrl;
    setPreview("");
    if (!url) {
      setPreview("");
      return;
    }
    let active = true;
    let blob = "";
    fetch(url, { headers: headers(), cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(t("errors.slipOpenFailed"));
        return r.blob();
      })
      .then((b) => {
        if (active) {
          blob = URL.createObjectURL(b);
          setPreview(blob);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [proofUrl, headers]);
  async function claim() {
    if (working) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const payload = jsonBody({ claimSelf: true });
      await request(`${endpoint}/claim`, { method: "POST", ...payload, headers: { ...payload.headers, ...headers() } });
      await load();
    } catch (error) { if (!redirectAccount(error)) setError((error as Error).message); }
    finally { setWorking(false); }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || (data?.bill.itemPayersEnabled && !selected)) return;
    setError("");
    setMessage("");
    if (file.size > 4 * 1024 * 1024) {
      setError(t("errors.slipFileTooLarge"));
      return;
    }
    setCheckingSlip(true);
    setWorking(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (selected) fd.append("settlementId", selected.id);
      const result = await request<any>(endpoint, {
        method: "POST",
        headers: headers(),
        body: fd,
      });
      await load();
      setMessage(result.status === "needs_review" ? t("payment.slipPendingNotice") : "");
    } catch (e) {
      if (!redirectAccount(e)) setError((e as Error).message);
    } finally {
      setCheckingSlip(false);
      setWorking(false);
    }
  }
  async function review(reverse = false) {
    if (data?.bill.itemPayersEnabled && !selected) return;
    setError("");
    setMessage("");
    if (reason.trim().length < 3) {
      setError(t("errors.reviewReasonTooShort"));
      return;
    }
    if (
      reverse &&
      !window.confirm(
        t("payment.reverseConfirmation"),
      )
    )
      return;
    setWorking(true);
    try {
      const payload = jsonBody({ reason, settlementId: selected?.id });
      await request(endpoint, {
        method: reverse ? "DELETE" : "PATCH",
        ...payload,
        headers: { ...payload.headers, ...headers() },
      });
      setReason("");
      await load();
      setMessage(
        reverse ? t("payment.reversedNotice") : t("payment.paymentConfirmed"),
      );
    } catch (e) {
      if (!redirectAccount(e)) setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function downloadQr() {
    if (readyQr !== qr) return;
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas || canvas.dataset.qrValue !== qr) return;
    const image = canvas.toDataURL("image/png");
    const bytes = Uint8Array.from(atob(image.split(",")[1]), character => character.charCodeAt(0));
    const file = new File([bytes], `PromptPay-${id}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    const link = document.createElement("a");
    link.href = image;
    link.download = `PromptPay-${id}.png`;
    link.click();
  }
  if (loading && !data)
    return (
      <div id="content" className="empty-state" role="status">
        <span className="spinner" /> {t("payment.openingYourPayment")} </div>
    );
  if (!data)
    return (
      <div id="content" className="empty-state">
        <Icon name="shield" size={35} />
        <h1>{t("payment.couldNotOpenPayment")}</h1>
        <p className="error" role="alert">
          {feedback(error)}
        </p>
        <Link className="button primary" href={sharedBillPath(id)}> {t("errors.reopenFromBill")} </Link>
        <button className="button secondary" onClick={load}> {t("common.retry")} </button>
      </div>
    );
  const [claimHintBefore, claimHintAfter] = t("payment.claimHint", ["\uFFFC"]).split("\uFFFC");
  const claimPanel = data.requiresClaim && !data.readOnly && !data.canManage ? <section className="payment-account-claim" aria-labelledby="payment-claim-heading">
    <h2 id="payment-claim-heading">{t("payment.claimTitle")}</h2>
    <p>{claimHintBefore}<strong className="claim-participant-name">{data.participant.name}</strong>{claimHintAfter}</p>
    <p><strong>{session?.user?.nickname}</strong> · @{session?.user?.username}</p>
    <p className="field-hint">{t("payment.claimPreserveHint")}</p>
    <button type="button" className="button primary full-width" disabled={working || loading} onClick={claim}>
      {t(working ? "common.saving" : "payment.claimAction")}</button>
    {error && <p className="error" role="alert">{feedback(error)}</p>}
  </section> : null;
  const claimTransfers = data.bill.itemPayersEnabled ? data.settlements : [{
    ...data.participant, name: data.bill.owner.name ?? t("bill.creator"), id: "owner",
  }];
  const unpaid = (payable: Payable) => Decimal.max(new Decimal(payable.totalPayable).minus(Decimal.max(payable.paidAmount, 0)), 0);
  const claimRemaining = claimTransfers.reduce((sum, transfer) => sum.plus(unpaid(transfer)), new Decimal(0));
  if ((data.requiresClaim || data.readOnly) && !data.canManage) return <div id="content" className="payment-page">
    <Link href={sharedBillPath(id)} className="text-link muted"><Icon name="back" size={16} />{t("nav.backToFullBill")}</Link>
    <article className="share-receipt payment-receipt">
      <div className="receipt-brand" lang="th">เคลียร์โต๊ะ <span lang="en">Clear Toh</span></div>
      <div className="pay-heading"><h1>{t("payment.claimPreviewTitle", [data.participant.name])}</h1><p>{data.bill.name}</p></div>
      {data.ownEntry ? <section className="payment-account-claim" aria-labelledby="payment-linked-heading">
        <h2 id="payment-linked-heading">{t("payment.alreadyLinkedTitle")}</h2>
        <p>{t("payment.alreadyLinkedHint", [data.ownEntry.name])}</p>
        <button type="button" className="button primary full-width" onClick={() => {
          const ownEntry = data.ownEntry;
          if (!ownEntry) return;
          try {
            sessionStorage.setItem(`payment:${id}:${ownEntry.id}`, ownEntry.paymentToken);
            router.push(ownEntry.paymentUrl);
          } catch { setError(t("errors.paymentStorageUnavailable")); }
        }}>{t("payment.openMyEntry")}</button>
        {error && <p className="error" role="alert">{feedback(error)}</p>}
      </section> : data.readOnly && <p className="field-hint">{t("payment.viewOnlyHint")}</p>}
      {claimPanel}
      <section className="payment-claim-summary" aria-labelledby="claim-amount-heading">
        <h2 id="claim-amount-heading">{t("payment.claimRemaining")}</h2>
        <strong className="claim-amount">฿ {baht(claimRemaining)}</strong>
        {claimRemaining.isZero() && <p className="field-hint">{t(data.readOnly ? "payment.viewOnlyNoOutgoing" : "payment.noOutgoingHint")}</p>}
        <dl className="expense-totals">
          {claimTransfers.map(transfer => <div key={transfer.id}>
            <dt>{t("payment.claimTransferTo", [transfer.name])}
              {new Decimal(transfer.paidAmount).gt(0) && <small>{t("payment.claimPaidNote", [baht(transfer.totalPayable), baht(transfer.paidAmount)])}</small>}
            </dt><dd>฿ {baht(unpaid(transfer))}</dd>
          </div>)}
          {data.expenseDetails && new Decimal(data.expenseDetails.remainingToReceive).gt(0) && <div>
            <dt>{t("explanation.remainingToReceive")}</dt><dd>฿ {baht(data.expenseDetails.remainingToReceive)}</dd>
          </div>}
        </dl>
      </section>
      <ExpenseBreakdown details={data.expenseDetails} compact subjectName={data.readOnly ? data.participant.name : undefined} />
    </article>
  </div>;
  if (data.bill.itemPayersEnabled && data.settlements.length === 0) return (
    <div id="content" className="payment-page">
      <Link href={sharedBillPath(id)} className="text-link muted"><Icon name="back" size={16} />{t("nav.backToFullBill")}</Link>
      <article className="share-receipt payment-receipt">
      <div className="receipt-brand" lang="th">เคลียร์โต๊ะ <span lang="en">Clear Toh</span></div>
      <div className="pay-heading">
      <h1>{t("payment.personNoPaymentDue", [data.participant.name])}</h1>
      <p>{t("payment.noOutgoingHint")}</p>
      <LiveStatus status={liveStatus} />
      </div>
      <ExpenseBreakdown details={data.expenseDetails} initiallyOpen />
      </article>
    </div>
  );
  const p = selected ?? data.participant;
  const canSelectPayment = !data.bill.itemPayersEnabled || Boolean(selected);
  const guidedRecipientId = data.settlements.find((settlement) => recipientPaymentStatus(settlement) === "UNPAID" || recipientPaymentStatus(settlement) === "PARTIAL")?.id;
  const bankPending = isPendingEvidence(p.evidenceStatus);
  const receiverName = selected?.name ?? data.bill.owner.name ?? t("bill.creator");
  const remaining = Decimal.max(
    new Decimal(p.totalPayable).minus(p.paidAmount),
    0,
  );
  const testQr = canSelectPayment && process.env.NODE_ENV === "development" && remaining.gt(0);
  const qrAmount = testQr ? new Decimal(2) : remaining;
  let qr = "";
  const receiver = selected?.promptPayId ?? (data.bill.itemPayersEnabled ? null : data.bill.owner.promptPayId);
  try {
    if (canSelectPayment && receiver && /^(0\d{9}|\d{13})$/.test(receiver) && remaining.gt(0))
      qr = generatePayload(receiver, { amount: qrAmount.toNumber() });
  } catch {}
  return (
    <div id="content" className="payment-page">
      <Link className="text-link muted" href={sharedBillPath(id)}>
        <Icon name="back" size={16} /> {t("nav.backToFullBill")} </Link>
      <article className="share-receipt payment-receipt">
      <div className="receipt-brand" lang="th">เคลียร์โต๊ะ <span lang="en">Clear Toh</span></div>
      <div className="pay-heading">
        <h1>{t("payment.personTitle", [data.participant.name])}</h1>
        <p>
          {data.bill.name} {canSelectPayment && <>{t("payment.transferToNote")} {receiverName}</>}
        </p>
        <LiveStatus status={liveStatus} />
      </div>
      {claimPanel}
      {data.bill.itemPayersEnabled && data.settlements.length > 0 && (
        <div className="payment-recipients" role="group" aria-label={t("payment.chooseRecipient")} aria-describedby={!canSelectPayment && guidedRecipientId ? "recipient-selection-guide" : undefined}>
          <p>{t("payment.recipientCountHint", [data.settlements.length])}</p>
          <div className="recipient-options">
            {data.settlements.map((s) => {
              const due = Decimal.max(new Decimal(s.totalPayable).minus(s.paidAmount), 0);
              const status = recipientPaymentStatus(s);
              const paid = status === "PAID";
              return <div key={s.id} className="recipient-option-wrap">
              {!canSelectPayment && s.id === guidedRecipientId && <div id="recipient-selection-guide" className="recipient-selection-guide" role="note">
                <strong>{t("payment.recipientGuideTitle")}</strong>
                <span>{t("payment.selectRecipientFirst")}</span>
              </div>}
              <button type="button" className="recipient-option"
              aria-pressed={s.id === selected?.id} disabled={working || loading}
              onClick={() => { setSelectedId(s.id); setPreview(""); setReason(""); setError(""); setMessage(""); }}>
              <span>{s.name}</span><b>฿ {baht(s.totalPayable)}</b>
              <span className="recipient-option-meta"><span className={`status ${paid ? "status-published" : status === "UNPAID" ? "" : "status-draft"}`}>{t(recipientStatusLabels[status])}</span>
                {!paid && new Decimal(s.paidAmount).gt(0) && <small>{t("payment.remainingAmount", [baht(due)])}</small>}</span>
            </button></div>})}
          </div>
        </div>
      )}
      {canSelectPayment && !bankPending && <section className="qr-panel">
        {p.isPaid ? (
          <>
            <span className="status status-published">
              <Icon name="check" size={16} /> {t("payment.paymentConfirmedInFull")} </span>
            <strong>฿ {baht(p.paidAmount)}</strong>
            <p>{t("payment.thankYouForPayingYourShare")}</p>
          </>
        ) : (
          <>
            <p>{testQr ? t("payment.testPaymentTo") : t("payment.amountToPayTo")} {receiverName}</p>
            <strong>฿ {baht(qrAmount)}</strong>
            <p> {t("payment.fullAmount")} {baht(p.totalPayable)} {t("payment.paid")} {baht(p.paidAmount)}
            </p>
            {qr ? (
              <>
                <div ref={qrRef} className="qr-box">
                  <BrandedQr
                    value={qr}
                    onReady={setReadyQr}
                    title={t("payment.qrAccessibleLabel", [qrAmount.toFixed(2)])}
                  />
                </div>
                <div className="qr-label">PromptPay</div>
                <p>{receiver}</p>
                <button
                  className="button secondary full-width"
                  onClick={downloadQr}
                  disabled={readyQr !== qr}
                > {t("payment.savePaymentQR")} </button>
              </>
            ) : (
              <p className="warning"> {t("payment.noValidPromptPayNumberFor")} {receiverName} {t("payment.contactTheBillCreatorBeforePaying")} </p>
            )}
          </>
        )}
      </section>}
      {canSelectPayment && <section className="payment-proof">
        <div className="panel-heading">
          <h2>{t("payment.paymentEvidence")}</h2>
          {p.evidenceTransactedAt && p.payslipUrl ? (
            <time dateTime={p.evidenceTransactedAt} className="payment-proof-date">
              {t("payment.transferredAt")} {" "}
              {new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(p.evidenceTransactedAt))}
            </time>
          ) : <Icon name="upload" />}
        </div>
        {error && (
          <p className="error" role="alert">
            {feedback(error)}
          </p>
        )}
        {p.evidenceStatus && p.evidenceStatus !== "VERIFIED" && (
          <p
            className={`warning${bankPending ? " payment-bank-pending" : ""}`}
            role="status"
          >
            {bankPending && <span className="spinner" aria-hidden="true" />}
            {bankPending ? t("payment.bankPendingNotice")
                : p.evidenceStatus === "REJECTED" ? t("payment.bankVerificationFailed")
                  : t("payment.pendingReviewHint")}
          </p>
        )}
        {preview && (
          <img
            className="slip-preview"
            src={preview}
            alt={t("payment.paymentSlipForThisTransfer")}
          />
        )}
        {!p.isPaid && !bankPending && (
          <label className={`file-label receipt-upload${working || loading ? " is-disabled" : ""}${checkingSlip ? " is-checking" : ""}`}>
            {checkingSlip ? <span className="spinner" aria-hidden="true" /> : <Icon name="upload" size={26} />}
            <span role={checkingSlip ? "status" : undefined}>
              {checkingSlip ? t("payment.verifyingSlip") : t("payment.uploadYourSlipAfterPaying")}
            </span>
            {!checkingSlip && <small>{t("payment.slipFileHint")}</small>}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={working || loading}
              onChange={upload}
              aria-label={t("payment.chooseAPaymentSlipImage")}
            />
          </label>
        )}
        {message && (
          <p className="success" role="status">
            {feedback(message)}
          </p>
        )}
      </section>}
      {data.expenseDetails && <div className="payment-expense-details">
        {selected && <ExpenseBreakdown key={`overview-${selected.id}`} details={data.expenseDetails} />}
        <ExpenseBreakdown details={data.expenseDetails} recipient={selected} initiallyOpen={!selected} />
      </div>}
      {canSelectPayment && data.canManage && p.evidenceStatus && p.evidenceStatus !== "REJECTED" && (
        <section className="review-panel payment-review">
          <h2>{t("payment.forTheBillCreator")}</h2>
          <p className="field-hint"> {t("payment.reviewHint")} </p>
          <label className="field">
            <span>{t("payment.reasonForThisAction")}</span>
            <textarea
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("payment.reviewReasonPlaceholder")}
            />
          </label>
          {p.evidenceStatus === "NEEDS_REVIEW" && (
            <button
              className="button primary full-width"
              disabled={working}
              onClick={() => review(false)}
            > {t("payment.confirmPayment")} </button>
          )}
          <button
            className="button button-danger full-width"
            disabled={working}
            onClick={() => review(true)}
          > {t("payment.reversePaymentRetainEvidence")} </button>
        </section>
      )}
      <p className="receipt-end">{t("brand.tagline")}</p>
      </article>
    </div>
  );
}
