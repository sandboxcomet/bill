"use client";
import { sharedBillPath, manageBillPath } from "@/lib/bill-paths";
import type { TranslationKey } from "@/lib/i18n";
import { useI18n } from "@/components/LanguageProvider";
import Link from "@/components/LocalizedLink";
import { useCallback, useEffect, useState } from "react";
import type { BillListItem, BillPaymentStatus } from "@/lib/bill-list";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import LiveStatus from "./LiveStatus";
import { useSession } from "next-auth/react";
import { Icon } from "./Icons";
import { baht, request } from "@/lib/client";
import BillsDashboard from "./BillsDashboard";

type BillsResponse = { bills: BillListItem[]; payableBills: BillListItem[]; receivable: { amount: string; billCount: number }; spending: { share: string; shareBills: number; paid: string; paidBills: number } };

async function loadBills(overviewOnly: boolean, signal?: AbortSignal): Promise<BillsResponse> {
  const data = await request<BillsResponse>(overviewOnly ? "/api/dashboard" : "/api/bills", { signal });
  if (!data || !Array.isArray(data.bills) || !Array.isArray(data.payableBills) || (overviewOnly && (
    !data.receivable || typeof data.receivable.amount !== "string" || typeof data.receivable.billCount !== "number" ||
    !data.spending || typeof data.spending.share !== "string" || typeof data.spending.paid !== "string" ||
    typeof data.spending.shareBills !== "number" || typeof data.spending.paidBills !== "number"
  ))) throw new Error("errors.dashboardDataUnavailable");
  return data;
}

const labels: Record<string, TranslationKey> = {
  DRAFT: "bill.status.draft",
  PUBLISHED: "bill.status.published",
  CANCELLED: "bill.status.cancelled",
  UNSHARED: "bill.status.unshared",
};
const paymentLabels: Record<BillPaymentStatus, TranslationKey> = {
  UNPAID: "myBills.paymentUnpaid", PARTIAL: "myBills.paymentPartial", REVIEW: "myBills.paymentReview",
  BANK_PENDING: "payment.bankPendingShort", PAID: "myBills.paymentPaid", NO_PAYMENT: "myBills.noPayment",
};
export default function MyBills({ overviewOnly = false }: { overviewOnly?: boolean }) {
  const { t, formatLocale, feedback } = useI18n();
  const { status } = useSession();
  const [bills, setBills] = useState<BillListItem[]>([]);
  const [payableBills, setPayableBills] = useState<BillListItem[]>([]);
  const [receivable, setReceivable] = useState<BillsResponse["receivable"] | null>(null);
  const [spending, setSpending] = useState<BillsResponse["spending"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"OWNED" | "TO_PAY">("OWNED");
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setLoading(false);
      setBills([]);
      setPayableBills([]);
      setReceivable(null);
      setSpending(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    loadBills(overviewOnly)
      .then((d) => {
        if (active) { setBills(d.bills); setPayableBills(d.payableBills); setReceivable(d.receivable); setSpending(d.spending); }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, attempt, overviewOnly]);
  const refresh = useCallback(async (signal: AbortSignal) => {
    const data = await loadBills(overviewOnly, signal);
    if (!signal.aborted) { setBills(data.bills); setPayableBills(data.payableBills); setReceivable(data.receivable); setSpending(data.spending); }
  }, [overviewOnly]);
  const displayError = error || (overviewOnly && !loading && (!receivable || !spending) ? "errors.dashboardDataUnavailable" : "");
  const liveStatus = useLiveRefresh(refresh, status === "authenticated" && !loading && !displayError);
  const toPay = filter === "TO_PAY";
  const visible = (toPay ? payableBills : bills).filter(
    (b) => b.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div id="content">
      <div className="page-heading my-bills-heading">
        <div>
          <h1>{t(overviewOnly ? "nav.dashboard" : "nav.myBills")}</h1>
          <p>
            {loading
              ? t("myBills.loadingYourBills")
              : overviewOnly ? t("dashboard.pageHint") : toPay ? t("myBills.toPayHint", [payableBills.length]) : t("myBills.countHint", [bills.length])}
          </p>
          {!loading && !displayError && <LiveStatus status={liveStatus} />}
        </div>
        <Link className="button primary" href="/new">
          <Icon name="plus" size={18} /> {t("bill.create")} </Link>
      </div>
      {overviewOnly && !loading && !displayError && receivable && spending && <>
        <BillsDashboard bills={bills} payableBills={payableBills} receivable={receivable} spending={spending} />
        <Link className="button secondary" href="/bills">{t("dashboard.viewBills")} <Icon name="arrow" size={17} /></Link>
      </>}
      {(!overviewOnly || loading || Boolean(displayError)) &&
      <section className="bills-section" aria-label={t("myBills.myBillList")}>
        {!overviewOnly && <div className="list-toolbar">
          <div className="tabs" aria-label={t("myBills.filterBillStatus")}>
            {([
              ["OWNED", t("nav.myBills")],
              ["TO_PAY", t("myBills.toPayTab", [payableBills.length])],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "tab active" : "tab"}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label={t("myBills.searchBillsByName")}
              placeholder={t("myBills.searchBills")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>}
        {loading ? (
          <div className="empty-state" role="status">
            <span className="spinner" /> {t("myBills.loadingYourBills")} </div>
        ) : displayError ? (
          <div className="empty-state">
            <p className="error" role="alert">
              {feedback(displayError)}
            </p>
            <button
              className="button secondary"
              onClick={() => setAttempt((v) => v + 1)}
            > {t("common.retry")} </button>
          </div>
        ) : visible.length ? (
          <div className="bill-list">
            {visible.map((b) => (
              <Link
                key={b.id}
                className="bill-row"
                href={
                  ["DRAFT", "UNSHARED"].includes(b.status) ? manageBillPath(b.id) : sharedBillPath(b.id)
                }
              >
                <span className="bill-row-icon">
                  <Icon name="receipt" size={24} />
                </span>
                <div className="bill-row-name">
                  <h3>{b.name || t("myBills.untitledBill")}</h3>
                  <p>
                    {new Date(b.createdAt).toLocaleDateString(formatLocale, {
                      day: "numeric",
                      month: "short",
                    })}
                    <span>·</span>
                    {b._count.participants} {t("common.people")}<span>·</span>
                    {b._count.items} {t("bill.item")} </p>
                </div>
                <div className="bill-row-status">
                  <div className="bill-row-badges">
                    <span className={`status status-${b.status.toLowerCase()}`}>
                      {labels[b.status] ? t(labels[b.status]) : b.status}
                    </span>
                    {b.payment && <span className={`status ${["PAID", "NO_PAYMENT"].includes(b.payment.status) ? "status-published" : ["REVIEW", "BANK_PENDING", "PARTIAL"].includes(b.payment.status) ? "status-draft" : ""}`}>
                      {t(paymentLabels[b.payment.status])}
                    </span>}
                  </div>
                  {!toPay && b.payment && b.payment.totalPeople > 0 && <small>{t("myBills.settledPeople", [b.payment.settledCount, b.payment.totalPeople])}</small>}
                </div>
                <div className="bill-row-amount">
                  <small>{t(toPay ? "myBills.yourRemaining" : "myBills.billTotal")}</small>
                  <strong>฿ {baht(toPay ? b.payment!.remaining : b.grandTotal)}</strong>
                </div>
                <Icon name="arrow" size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="receipt" size={32} />
            </span>
            <h3>
              {search
                ? t("myBills.noMatchingBills")
                : toPay ? t("myBills.noPayableBills") : t("myBills.createYourFirstBill")}
            </h3>
            <p>
              {search
                ? t("myBills.tryAnotherName")
                : toPay ? t("myBills.payableEmptyHint") : t("myBills.emptyHint")}
            </p>
            {toPay ? <button className="button secondary" onClick={() => setFilter("OWNED")}>{t("myBills.showCreated")}</button>
              : <Link className="button secondary" href="/new"><Icon name="plus" size={17} /> {t("bill.create")}</Link>}
          </div>
        )}
      </section>
      }
    </div>
  );
}
