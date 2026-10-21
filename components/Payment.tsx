"use client";
import { useI18n } from "@/components/LanguageProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/LocalizedLink";
import BrandedQr from "./BrandedQr";
import generatePayload from "promptpay-qr";
import Decimal from "decimal.js";
import { baht, request, jsonBody } from "@/lib/client";
import { Icon } from "./Icons";
import type { ExpenseItem } from "@/lib/expense-details";
import ExpenseBreakdown, { type ExpenseDetails } from "./ExpenseBreakdown";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import LiveStatus from "./LiveStatus";
type Payable = {
  name: string;
  totalPayable: string;
  paidAmount: string;
  isPaid: boolean;
  payslipUrl: string | null;
  evidenceStatus: string | null;
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
  expenseDetails?: ExpenseDetails | null;
};
export default function Payment({ id, pid }: { id: string; pid: string }) {
  const { t, feedback } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const [reason, setReason] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = data?.settlements.find((s) => s.id === selectedId) ?? data?.settlements[0];
  const proofUrl = selected?.payslipUrl ?? (!data?.bill.itemPayersEnabled ? data?.participant.payslipUrl : null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [readyQr, setReadyQr] = useState("");
  const endpoint = `/api/bills/${id}/participants/${pid}`;
  // Version the read URL so Fast Refresh also reloads pre-recipient expense data.
  const readEndpoint = `${endpoint}?expenseDetails=explanation-v2`;
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
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [readEndpoint, headers]);
  useEffect(() => {
    void load();
  }, [load]);
  const refresh = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(readEndpoint, { headers: headers(), cache: "no-store", signal });
    const result = await response.json();
    if (signal.aborted) return;
    if ([401, 403, 404].includes(response.status)) {
      setData(null);
      setError("เปิดจากหน้าบิลอีกครั้ง");
      return;
    }
    if (!response.ok) throw new Error("Refresh failed");
    setData(result);
  }, [readEndpoint, headers]);
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
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > 4 * 1024 * 1024) {
      setError(t("errors.slipFileTooLarge"));
      return;
    }
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
      setMessage(
        result.status === "needs_review"
          ? t("payment.slipPendingNotice")
          : t("payment.slipVerifiedNotice"),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function review(reverse = false) {
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
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function downloadQr() {
    if (readyQr !== qr) return;
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas || canvas.dataset.qrValue !== qr) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
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
        <Link className="button primary" href={`/bill/${id}`}> {t("errors.reopenFromBill")} </Link>
        <button className="button secondary" onClick={load}> {t("common.retry")} </button>
      </div>
    );
  if (data.bill.itemPayersEnabled && !selected) return (
    <div id="content" className="payment-page">
      <Link href={`/bill/${id}`} className="text-link muted"><Icon name="back" size={16} />{t("nav.backToFullBill")}</Link>
      <article className="share-receipt payment-receipt">
      <div className="receipt-brand" lang="th">เคลียร์โต๊ะ <span lang="en">Clear Toh</span></div>
      <div className="pay-heading">
      <h1>{t("payment.personNoPaymentDue", [data.participant.name])}</h1>
      <p>{t("payment.noOutgoingHint")}</p>
      <LiveStatus status={liveStatus} />
      </div>
      <ExpenseBreakdown details={data.expenseDetails} />
      </article>
    </div>
  );
  const p = selected ?? data.participant;
  const receiverName = selected?.name ?? data.bill.owner.name ?? t("bill.creator");
  const remaining = Decimal.max(
    new Decimal(p.totalPayable).minus(p.paidAmount),
    0,
  );
  const testQr = process.env.NODE_ENV === "development" && remaining.gt(0);
  const qrAmount = testQr ? new Decimal(2) : remaining;
  let qr = "";
  const receiver = selected?.promptPayId ?? (data.bill.itemPayersEnabled ? null : data.bill.owner.promptPayId);
  try {
    if (receiver && /^(0\d{9}|\d{13})$/.test(receiver) && remaining.gt(0))
      qr = generatePayload(receiver, { amount: qrAmount.toNumber() });
  } catch {}
  return (
    <div id="content" className="payment-page">
      <Link className="text-link muted" href={`/bill/${id}`}>
        <Icon name="back" size={16} /> {t("nav.backToFullBill")} </Link>
      <article className="share-receipt payment-receipt">
      <div className="receipt-brand" lang="th">เคลียร์โต๊ะ <span lang="en">Clear Toh</span></div>
      <div className="pay-heading">
        <h1>{t("payment.personTitle", [data.participant.name])}</h1>
        <p>
          {data.bill.name} {t("payment.transferToNote")} {receiverName}
        </p>
        <LiveStatus status={liveStatus} />
      </div>
      {data.bill.itemPayersEnabled && data.settlements.length > 1 && (
        <div className="payment-recipients" role="group" aria-label={t("payment.chooseRecipient")}>
          <p>{t("payment.recipientCountHint", [data.settlements.length])}</p>
          <div className="recipient-options">
            {data.settlements.map((s) => <button key={s.id} type="button" className="recipient-option"
              style={{ padding: "14px 16px" }}
              aria-pressed={s.id === selected?.id} disabled={working || loading}
              onClick={() => { setSelectedId(s.id); setReason(""); setError(""); setMessage(""); }}>
              <span>{s.name}</span><b>฿ {baht(s.totalPayable)}</b>
              <small>{s.isPaid ? t("common.fullyPaid") : t("payment.remainingAmount", [baht(Decimal.max(new Decimal(s.totalPayable).minus(s.paidAmount), 0))])}</small>
            </button>)}
          </div>
        </div>
      )}
      {selected && <ExpenseBreakdown details={data.expenseDetails} />}
      <ExpenseBreakdown details={data.expenseDetails} recipient={selected} />
      <section className="qr-panel">
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
            {testQr && <p className="warning">{t("payment.testQR2BahtActualRemaining")} {baht(remaining)}</p>}
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
                <p className="field-hint"> {t("payment.bankAppCheckHint")} </p>
              </>
            ) : (
              <p className="warning"> {t("payment.noValidPromptPayNumberFor")} {receiverName} {t("payment.contactTheBillCreatorBeforePaying")} </p>
            )}
          </>
        )}
      </section>
      <section className="payment-proof">
        <div className="panel-heading">
          <h2>{t("payment.paymentEvidence")}</h2>
          <Icon name="upload" />
        </div>
        {p.evidenceStatus && (
          <p
            className={p.evidenceStatus === "VERIFIED" ? "success" : "warning"}
          >
            {p.evidenceStatus === "VERIFIED"
              ? t("payment.paymentSlipVerified")
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
        {!p.isPaid && (
          <label className={`file-label receipt-upload${working || loading ? " is-disabled" : ""}`}>
            <Icon name="upload" size={26} />
            <span>
              {working ? t("payment.verifyingSlip") : t("payment.uploadYourSlipAfterPaying")}
            </span>
            <small>{t("payment.slipFileHint")}</small>
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
        {error && (
          <p className="error" role="alert">
            {feedback(error)}
          </p>
        )}
        <button
          className="text-link"
          disabled={working || loading}
          style={{
            background: "none",
            border: 0,
            marginTop: 14,
            minHeight: 35,
          }}
          onClick={load}
        > {t("payment.refreshPaymentStatus")} </button>
      </section>
      {data.canManage && p.evidenceStatus && (
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
