"use client";
import type { TranslationKey } from "@/lib/i18n";
import { useI18n } from "@/components/LanguageProvider";
import Link from "@/components/LocalizedLink";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "./Icons";
import { baht, request } from "@/lib/client";

type Bill = {
  id: string;
  name: string;
  status: string;
  grandTotal: string;
  createdAt: string;
  _count: { participants: number; items: number };
};
const labels: Record<string, TranslationKey> = {
  DRAFT: "bill.status.draft",
  PUBLISHED: "bill.status.published",
  CANCELLED: "bill.status.cancelled",
};
export default function MyBills() {
  const { t, formatLocale, feedback } = useI18n();
  const { status } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setLoading(false);
      setBills([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request<{ bills: Bill[] }>("/api/bills")
      .then((d) => {
        if (active) setBills(d.bills);
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
  const visible = bills.filter(
    (b) =>
      (filter === "ALL" || b.status === filter) &&
      b.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div id="content">
      <div className="page-heading my-bills-heading">
        <div>
          <h1>{t("nav.myBills")}</h1>
          <p>
            {loading
              ? t("myBills.loadingYourBills")
              : t("myBills.countHint", [bills.length])}
          </p>
        </div>
        <Link className="button primary" href="/new">
          <Icon name="plus" size={18} /> {t("bill.create")} </Link>
      </div>
      <section className="bills-section" aria-label={t("myBills.myBillList")}>
        <div className="list-toolbar">
          <div className="tabs" aria-label={t("myBills.filterBillStatus")}>
            {[
              ["ALL", t("myBills.all")],
              ["DRAFT", t("bill.status.draft")],
              ["PUBLISHED", t("bill.status.published")],
            ].map(([key, label]) => (
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
                  b.status === "DRAFT" ? `/bills/${b.id}/edit` : `/bill/${b.id}`
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
                <span className={`status status-${b.status.toLowerCase()}`}>
                  {labels[b.status] ? t(labels[b.status]) : b.status}
                </span>
                <strong className="bill-row-amount">
                  ฿ {baht(b.grandTotal)}
                </strong>
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
                : filter !== "ALL"
                  ? t("myBills.noBillsWithThisStatus")
                  : t("myBills.createYourFirstBill")}
            </h3>
            <p>
              {search
                ? t("myBills.tryAnotherName")
                : filter !== "ALL"
                  ? t("myBills.statusFilterHint")
                  : t("myBills.emptyHint")}
            </p>
            <Link className="button secondary" href="/new">
              <Icon name="plus" size={17} /> {t("bill.create")} </Link>
          </div>
        )}
      </section>
    </div>
  );
}
