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
export default function MyBills() {
  const { t, formatLocale, feedback } = useI18n();
  const { status } = useSession();
  const [bills, setBills] = useState<BillListItem[]>([]);
  const [payableBills, setPayableBills] = useState<BillListItem[]>([]);
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
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request<{ bills: BillListItem[]; payableBills: BillListItem[] }>("/api/bills")
      .then((d) => {
        if (active) { setBills(d.bills); setPayableBills(d.payableBills); }
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
  }, [status, attempt]);
  const refresh = useCallback(async (signal: AbortSignal) => {
    const data = await request<{ bills: BillListItem[]; payableBills: BillListItem[] }>("/api/bills", { signal });
    if (!signal.aborted) { setBills(data.bills); setPayableBills(data.payableBills); }
  }, []);
  const liveStatus = useLiveRefresh(refresh, status === "authenticated" && !loading && !error);
  const toPay = filter === "TO_PAY";
  const visible = (toPay ? payableBills : bills).filter(
    (b) => b.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div id="content">
      <div className="page-heading my-bills-heading">
        <div>
          <h1>{t("nav.myBills")}</h1>
          <p>
            {loading
              ? t("myBills.loadingYourBills")
              : toPay ? t("myBills.toPayHint", [payableBills.length]) : t("myBills.countHint", [bills.length])}
          </p>
          {!loading && !error && <LiveStatus status={liveStatus} />}
        </div>
        <Link className="button primary" href="/new">
          <Icon name="plus" size={18} /> {t("bill.create")} </Link>
      </div>
      <section className="bills-section" aria-label={t("myBills.myBillList")}>
        <div className="list-toolbar">
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
        </div>
        {loading ? (
          <div className="empty-state" role="status">
            <span className="spinner" /> {t("myBills.loadingYourBills")} </div>
        ) : error ? (
          <div className="empty-state">
            <p className="error" role="alert">
              {feedback(error)}
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
    </div>
  );
}
