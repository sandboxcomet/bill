"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import generatePayload from "promptpay-qr";
import { useI18n } from "@/components/LanguageProvider";
import { baht, jsonBody, request } from "@/lib/client";
import BrandedQr from "./BrandedQr";
import { isValidPromptPayId, promptPayErrorKey } from "@/lib/promptpay";
import styles from "./RefundPanel.module.css";

type Refund = {
  id: string; amount: string; refundedAmount: string; fromName: string; toName: string;
  fromParticipantId: string | null; toParticipantId: string; promptPayId: string | null;
  canPay: boolean; canReview: boolean; evidenceStatus: string | null; evidenceAmount: string | null; evidenceUrl: string | null;
  originalEvidence: { url: string; amount: string }[];
  ownerCanSetPromptPay?: boolean;
};
const ignoreReady = () => {};

export default function RefundPanel({ billId, participantId }: { billId: string; participantId?: string }) {
  const { t, feedback } = useI18n();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingRefund, setEditingRefund] = useState("");
  const [promptPay, setPromptPay] = useState("");
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const qrContainers = useRef<Record<string, HTMLDivElement | null>>({});
  const headers = useCallback(() => {
    let token = "";
    if (participantId) try { token = sessionStorage.getItem(`payment:${billId}:${participantId}`) ?? ""; } catch { /* Storage unavailable. */ }
    return { "x-payment-token": token };
  }, [billId, participantId]);
  const load = useCallback(async () => {
    const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
    const data = await request<{ refunds: Refund[] }>(`/api/bills/${billId}/refunds${query}`, { headers: headers() });
    setRefunds(data.refunds);
  }, [billId, participantId, headers]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void load().catch(() => { setRefunds([]); }); }, 3000);
    return () => clearInterval(timer);
  }, [load]);
  const proofUrls = JSON.stringify(refunds.flatMap(r => [...(r.evidenceUrl ? [r.evidenceUrl] : []), ...r.originalEvidence.map(e => e.url)]));
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    for (const url of JSON.parse(proofUrls) as string[]) {
      void fetch(url, { headers: headers(), cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error("Slip unavailable");
        return response.blob();
      }).then(blob => {
        if (!active) return;
        const src = URL.createObjectURL(blob); urls.push(src);
        setProofs(previous => ({ ...previous, [url]: src }));
      }).catch(() => {});
    }
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [proofUrls, headers]);
  async function upload(refund: Refund, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBusy(refund.id); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("file", file);
      await request(`/api/bills/${billId}/refunds/${refund.id}`, { method: "POST", headers: headers(), body: form });
      await load(); setMessage(t("refund.recorded"));
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(""); }
  }
  async function saveRecipient(refund: Refund, event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPromptPayId(promptPay)) { setError(t(promptPayErrorKey(promptPay))); return; }
    setBusy(refund.id); setError("");
    try {
      await request(`/api/bills/${billId}/refunds`, { method: "PATCH", ...jsonBody({ refundId: refund.id, promptPayId: promptPay }) });
      setEditingRefund(""); setPromptPay(""); await load(); setMessage(t("refund.promptPaySaved"));
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(""); }
  }
  async function confirm(refund: Refund, reject = false) {
    if (!window.confirm(t(reject ? "refund.rejectPrompt" : "refund.confirmPrompt"))) return;
    setBusy(refund.id); setError(""); setMessage("");
    try {
      const payload = jsonBody({ action: reject ? "reject" : "confirm", reason: t(reject ? "refund.rejectReason" : "refund.reason") });
      await request(`/api/bills/${billId}/refunds/${refund.id}`, { method: "PATCH", ...payload, headers: { ...payload.headers, ...headers() } });
      await load(); setMessage(t("refund.recorded"));
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(""); }
  }
  async function saveQr(refund: Refund, expected: string) {
    const canvas = qrContainers.current[refund.id]?.querySelector("canvas");
    if (!canvas?.dataset.qrValue || canvas.dataset.qrValue !== expected) return;
    const image = canvas.toDataURL("image/png");
    const bytes = Uint8Array.from(atob(image.split(",")[1]), character => character.charCodeAt(0));
    const file = new File([bytes], `refund-${refund.id}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; }
      catch (error) { if ((error as Error).name === "AbortError") return; }
    }
    const link = document.createElement("a"); link.href = image; link.download = file.name; link.click();
  }
  if (!refunds.length && !error) return null;
  return <section className={participantId ? styles.receiptSection : `panel ${styles.editorSection}`} aria-labelledby="refund-heading">
    <div className={styles.heading}><h2 id="refund-heading">{t("refund.title")}</h2></div>
    {error && <p className="error" role="alert">{feedback(error)}</p>}
    {message && <p className="success" role="status">{message}</p>}
    {refunds.map(refund => {
      const remaining = Decimal.max(new Decimal(refund.amount).minus(refund.refundedAmount), 0);
      const pending = ["PENDING", "PENDING_UPLOAD", "UPLOADING"].includes(refund.evidenceStatus ?? "");
      const review = refund.evidenceStatus === "NEEDS_REVIEW";
      const incoming = participantId === refund.toParticipantId || (!participantId && refund.canReview && !refund.canPay);
      const outgoing = participantId === refund.fromParticipantId || (!participantId && refund.canPay);
      const tone = remaining.isZero() ? styles.complete : outgoing ? styles.outgoing : incoming ? styles.incoming : styles.neutral;
      const status = remaining.isZero() ? t("refund.completed") : pending ? t("refund.bankPendingStatus") : review ? t("refund.reviewStatus") : outgoing ? t("refund.returnDue") : incoming ? t("refund.awaitingReturn") : t("refund.waitingShort");
      const qrAmount = process.env.NODE_ENV === "development" ? Decimal.min(remaining, 2) : remaining;
      let qr = "";
      try { if (refund.canPay && refund.promptPayId && remaining.gt(0)) qr = generatePayload(refund.promptPayId, { amount: qrAmount.toNumber() }); } catch { /* Invalid number is reported below. */ }
      return <div className={styles.entry} key={refund.id}>
        <div className={`${styles.summary} ${tone}`}>
          <div className={styles.summaryTop}><h3>{t("refund.transfer", [refund.fromName, refund.toName])}</h3><span className={styles.status}>{status}</span></div>
          <div className={styles.amount}><span>{t("refund.remaining")}</span><strong>฿ {baht(remaining)}</strong></div>
        </div>
        {!participantId && refund.ownerCanSetPromptPay && (editingRefund === refund.id ?
          <form onSubmit={event => void saveRecipient(refund, event)}>
            <label className="field"><span>{t("refund.promptPayFor", [refund.toName])}</span>
              <input type="text" inputMode="numeric" autoComplete="off" maxLength={13} value={promptPay} onChange={event => setPromptPay(event.target.value.replace(/\D/g, ""))} required /></label>
            <p className="field-hint">{t("refund.verifyRecipient")}</p>
            <div className="editor-share-actions"><button type="submit" className="button primary" disabled={Boolean(busy)}>{t("common.save")}</button>
              <button type="button" className="button secondary" onClick={() => { setEditingRefund(""); setPromptPay(""); setError(""); }}>{t("common.cancel")}</button></div>
          </form> : <div><p className="warning">{t("refund.ownerMissingPromptPay", [refund.toName])}</p>
            <button type="button" className="button secondary" onClick={() => { setEditingRefund(refund.id); setPromptPay(""); setError(""); }}>{t("payer.addPromptPay")}</button></div>)}
        {!remaining.isZero() && (pending ? <p className={styles.stateMessage} role="status">{t("refund.pending")}</p> : review ? <p className={styles.stateMessage}>{t("refund.review")}</p> : refund.canPay ? <>
          {qr ? <>{process.env.NODE_ENV === "development" && <p className="warning">{t("refund.testQr", [baht(qrAmount)])}</p>}
            <div className="qr-box" ref={node => { qrContainers.current[refund.id] = node; }}><BrandedQr value={qr} title={t("payment.qrAccessibleLabel", [qrAmount.toFixed(2)])} onReady={ignoreReady} /></div>
            <button type="button" className="button secondary" onClick={() => saveQr(refund, qr)}>{t("payment.savePaymentQR")}</button></> : <p className="warning">{t("refund.noPromptPay")}</p>}
          {qr && <label className="file-label receipt-upload"><span>{busy === refund.id ? t("refund.checking") : t("refund.upload")}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(busy)} onChange={event => upload(refund, event)} />
          </label>}
          {refund.evidenceStatus === "REJECTED" && <p className="warning">{t("refund.rejected")}</p>}
        </> : <p className={styles.stateMessage}>{t("refund.waiting")}</p>)}
        {refund.evidenceAmount && refund.evidenceUrl && <p>{t("payment.paymentEvidence")}: ฿ {baht(refund.evidenceAmount)}</p>}
        {refund.evidenceUrl && proofs[refund.evidenceUrl] && <img className="slip-preview" src={proofs[refund.evidenceUrl]} alt={t("payment.paymentSlipForThisTransfer")} />}
        {refund.originalEvidence.length > 0 && <details className={styles.original}><summary>{t("refund.originalPayments")}</summary>
          {refund.originalEvidence.map(e => <div className="payment-slip" key={e.url}><p>฿ {baht(e.amount)}</p>{proofs[e.url] && <img className="slip-preview" src={proofs[e.url]} alt={t("payment.paymentSlipForThisTransfer")} />}</div>)}
        </details>}
        {review && refund.canReview && <div className="editor-share-actions">
          <button type="button" className="button primary" disabled={Boolean(busy) || !refund.evidenceUrl || !proofs[refund.evidenceUrl]} onClick={() => confirm(refund)}>{t("refund.confirm")}</button>
          <button type="button" className="button secondary" disabled={Boolean(busy) || !refund.evidenceUrl || !proofs[refund.evidenceUrl]} onClick={() => confirm(refund, true)}>{t("refund.reject")}</button>
        </div>}
      </div>;
    })}
  </section>;
}
