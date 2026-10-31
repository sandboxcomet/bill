"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import Link from "@/components/LocalizedLink";
import { sharedBillPath } from "@/lib/bill-paths";
import type { BillListItem } from "@/lib/bill-list";
import { baht, request } from "@/lib/client";
import { Icon } from "./Icons";
import styles from "./Notifications.module.css";

type BillResponse = { bills: BillListItem[]; payableBills: BillListItem[] };
type Notice = { key: string; name: string; href: string; kind: "pay" | "review"; amount?: string };

export default function Notifications() {
  const { t } = useI18n();
  const menu = useRef<HTMLDetailsElement>(null);
  const requestVersion = useRef(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++requestVersion.current;
    try {
      const data = await request<BillResponse>("/api/bills", { signal, cache: "no-store" });
      if (!Array.isArray(data.bills) || !Array.isArray(data.payableBills)) throw new Error("Invalid response");
      const payments: Notice[] = data.payableBills.filter(b => b.payment && ["UNPAID", "PARTIAL"].includes(b.payment.status)).map(b => ({
        key: `pay:${b.id}`, name: b.name, href: sharedBillPath(b.id), kind: "pay", amount: b.payment!.remaining,
      }));
      const reviews: Notice[] = data.bills.filter(b => b.status === "PUBLISHED" && b.payment?.status === "REVIEW").map(b => ({
        key: `review:${b.id}`, name: b.name, href: sharedBillPath(b.id), kind: "review",
      }));
      if (!signal?.aborted && version === requestVersion.current) { setNotices([...payments, ...reviews]); setStatus("ready"); }
    } catch {
      if (!signal?.aborted && version === requestVersion.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal); };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const dismiss = (event: Event) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && menu.current?.open) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); document.removeEventListener("pointerdown", dismiss); document.removeEventListener("focusin", dismiss); document.removeEventListener("keydown", escape); };
  }, [load]);

  return <details ref={menu} className={styles.menu} onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary className={styles.trigger} aria-label={status === "ready" ? t("notifications.count", [notices.length]) : t("notifications.title")}>
      <Icon name="bell" size={21} />
      {status === "ready" && notices.length > 0 && <span className={styles.badge} aria-hidden="true">{notices.length > 99 ? "99+" : notices.length}</span>}
    </summary>
    <div className={styles.panel}>
      <div className={styles.heading}><strong>{t("notifications.title")}</strong><span>{t("notifications.hint")}</span></div>
      {status === "loading" ? <p className={styles.empty}>{t("notifications.loading")}</p>
        : status === "error" ? <div className={styles.empty}><p>{t("notifications.error")}</p><button type="button" className={styles.retry} onClick={() => void load()}>{t("notifications.retry")}</button></div>
        : notices.length === 0 ? <p className={styles.empty}>{t("notifications.empty")}</p>
        : <div className={styles.list}>{notices.map(notice => <Link key={notice.key} className={styles.item} href={notice.href} onClick={() => { if (menu.current) menu.current.open = false; }}>
          <span className={styles.itemIcon}><Icon name={notice.kind === "pay" ? "receipt" : "shield"} size={18} /></span>
          <span className={styles.content}><strong>{notice.name || t("myBills.untitledBill")}</strong><span>{notice.kind === "pay" ? t("notifications.pay", [baht(notice.amount!)]) : t("notifications.review")}</span></span>
          <Icon name="arrow" size={16} />
        </Link>)}</div>}
    </div>
  </details>;
}
