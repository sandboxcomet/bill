"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { baht, request } from "@/lib/client";

type Revision = { version: number; createdAt: string; name: string; grandTotal: string; serviceCharge: string; vat: string;
  items: { name: string; price: string; quantity: number; discountRate: string }[];
  participants: { name: string; paidAmount: string }[] };

export default function BillRevisionHistory({ billId }: { billId: string }) {
  const { t, formatLocale } = useI18n();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  useEffect(() => { let active = true; void request<{ revisions: Revision[] }>(`/api/bills/${billId}/revisions`).then(data => {
    if (active) setRevisions(data.revisions);
  }).catch(() => {}); return () => { active = false; }; }, [billId]);
  if (!revisions.length) return null;
  return <section className="panel" aria-labelledby="revision-history-heading">
    <h2 id="revision-history-heading">{t("editor.revisionHistory")}</h2>
    {revisions.map(revision => <details key={revision.version}>
      <summary>{t("editor.revisionBefore", [revision.version])} · {new Intl.DateTimeFormat(formatLocale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(revision.createdAt))}</summary>
      <p><strong>{revision.name}</strong> · {t("bill.totalLabel")} ฿ {baht(revision.grandTotal)}</p>
      <ul>{revision.items.map((item, index) => <li key={`${revision.version}-${index}`}>
        {item.name} · {item.quantity} × ฿ {baht(item.price)}{Number(item.discountRate) > 0 && ` · −${item.discountRate}%`}
      </li>)}</ul>
      <p>Service charge ฿ {baht(revision.serviceCharge)} · VAT ฿ {baht(revision.vat)}</p>
      {revision.participants.map((person, index) => <p key={index}>{person.name} · {t("editor.revisionPaid")} ฿ {baht(person.paidAmount)}</p>)}
    </details>)}
  </section>;
}
