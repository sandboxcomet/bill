"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ExpenseDetails, ExpenseRecipient } from "@/lib/expense-details";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useI18n } from "./LanguageProvider";
import ExpenseBreakdown from "./ExpenseBreakdown";
import LiveStatus from "./LiveStatus";
import { Icon } from "./Icons";
type Details = { expenseDetails: ExpenseDetails; settlements: (ExpenseRecipient & { id: string })[] };
export default function AmountExplanation({ billId, participantId, name, token, children }: {
  billId: string; participantId: string; name: string; token: string; children: React.ReactNode;
}) {
  const { t, feedback } = useI18n();
  const id = useId(); const dialog = useRef<HTMLDialogElement>(null);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Details | null>(null); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  const read = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/participants/${encodeURIComponent(participantId)}/expenses`, {
      headers: { "x-payment-token": tokenRef.current }, cache: "no-store", signal,
    });
    const result = await response.json(); if (signal.aborted) return;
    if ([401, 403, 404].includes(response.status)) { setData(null); setError("errors.reopenFromBill"); return; }
    if (!response.ok) throw new Error(result.error || "errors.billLoadFailed");
    setData(result); setError("");
  }, [billId, participantId]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    if (!dialog.current?.open) dialog.current?.showModal();
    setLoading(true); setData(null); setError("");
    void read(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, read, attempt]);
  const liveStatus = useLiveRefresh(read, open && !loading && Boolean(data));
  return <>
    <button type="button" className="amount-details-trigger" aria-label={t("explanation.openFor", [name])} aria-describedby={`${id}-amount`} aria-haspopup="dialog" onClick={() => { setData(null); setLoading(true); setError(""); setOpen(true); }}>
      <span id={`${id}-amount`}>{children}</span><Icon name="help" size={14} />
    </button>
    <dialog ref={dialog} className="amount-details-dialog" aria-labelledby={id} onClose={() => setOpen(false)}>
      <div className="receipt-image-heading"><h2 id={id}>{t("explanation.title", [name])}</h2><button className="icon-button" type="button" aria-label={t("common.close")} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      {loading && <p role="status">{t("explanation.loading")}</p>}
      {error && <p className="error" role="alert">{feedback(error)} <button type="button" className="text-link" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
      {data && <><LiveStatus status={liveStatus} /><ExpenseBreakdown details={data.expenseDetails} initiallyOpen />
        {data.settlements.length > 0 && <section className="explanation-recipients"><h3>{t("explanation.recipientsHeading")}</h3>
          {data.settlements.map(recipient => <ExpenseBreakdown key={recipient.id} details={data.expenseDetails} recipient={recipient} />)}
        </section>}
      </>}
    </dialog>
  </>;
}
