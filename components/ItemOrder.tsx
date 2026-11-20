"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import styles from "./ItemOrder.module.css";

type Item = { id: string; name: string; restaurantId: string | null; quantity: number; price: string };
type Place = { id: string; name: string };

export default function ItemOrder({ billId }: { billId: string }) {
  const { t, formatLocale } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [original, setOriginal] = useState<string[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef<{ id: string; pointerId: number; targetId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bills/${encodeURIComponent(billId)}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const { bill } = await response.json();
      setItems(bill.items); setOriginal(bill.items.map((item: Item) => item.id));
      setPlaces(Array.isArray(bill.restaurants) ? bill.restaurants : []); setName(bill.name);
    }).catch(() => { if (!controller.signal.aborted) setError("order.error"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [billId]);
  const changed = items.some((item, index) => item.id !== original[index]);
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item);
    setItems(next); setSaved(false);
  }
  function dragOver(clientX: number, clientY: number) {
    const id = dragging.current?.id;
    if (!id) return;
    setPointer({ x: clientX, y: clientY });
    const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLTableRowElement>("tr[data-order-item]");
    const targetId = row?.dataset.orderItem;
    if (targetId && dragging.current && targetId !== dragging.current.targetId) {
      dragging.current.targetId = targetId;
      setDropId(targetId);
    }
    if (clientY < 60) window.scrollBy(0, -15);
    else if (clientY > window.innerHeight - 60) window.scrollBy(0, 15);
  }
  function endDrag(commit = false) {
    const drag = dragging.current;
    dragging.current = null;
    setDraggedId(null);
    setDropId(null);
    setPointer(null);
    if (commit && drag && drag.id !== drag.targetId) {
      const from = items.findIndex(item => item.id === drag.id);
      const to = items.findIndex(item => item.id === drag.targetId);
      if (from >= 0 && to >= 0) move(from, to);
    }
  }
  const save = useCallback(async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/order`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ original, items: items.map(item => item.id) }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error === "order.conflict" ? "order.conflict" : "order.error"); }
      setOriginal(items.map(item => item.id)); setSaved(true);
    } catch (e) { setError(e instanceof Error && e.message === "order.conflict" ? "order.conflict" : "order.error"); }
    finally { setSaving(false); }
  }, [billId, items, original]);
  useEffect(() => {
    if (loading || saving || !changed || draggedId || error) return;
    const timer = window.setTimeout(() => { void save(); }, 600);
    return () => window.clearTimeout(timer);
  }, [loading, saving, changed, draggedId, error, save]);
  useEffect(() => {
    if (!changed && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed, saving]);
  return <main id="content" className={styles.page}>
    <Link href={`/manage/${encodeURIComponent(billId)}`} className="text-link muted" onClick={event => { if ((changed || saving) && !window.confirm(t("order.leaveWarning"))) event.preventDefault(); }}>← {t("order.back")}</Link>
    <div className={styles.header}><div><h1>{t("order.title")}</h1>{name && <p className={styles.billName}>{name}</p>}<p>{t("order.hint")}</p></div>
      <span className={styles.saved} role="status">{saving ? t("order.saving") : changed && !error ? t("order.pending") : saved && !error ? t("order.saved") : ""}</span></div>
    {error && <p className="error" role="alert">{t(error === "order.conflict" ? "order.conflict" : "order.error")} {error === "order.conflict" || loading || !items.length ? <button type="button" className="text-link" onClick={() => window.location.reload()}>{t("common.reload")}</button> : <button type="button" className="text-link" onClick={() => setError("")}>{t("notifications.retry")}</button>}</p>}
    {loading ? <p>{t("common.openingBill")}</p> : !items.length ? <p>{t("order.empty")}</p> : <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th scope="col"><span className={styles.srOnly}>{t("order.dragColumn")}</span></th><th scope="col">{t("order.position")}</th><th scope="col">{t("order.item")}</th><th scope="col">{t("order.place")}</th><th scope="col">{t("order.move")}</th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={item.id} data-order-item={item.id} className={draggedId === item.id ? styles.dragging : dropId === item.id ? (index < items.findIndex(entry => entry.id === draggedId) ? styles.dropBefore : styles.dropAfter) : undefined}>
        <td><button type="button" className={styles.dragHandle} disabled={saving} aria-label={t("order.dragItem", [item.name || t("order.unnamed")])} title={t("order.dragItem", [item.name || t("order.unnamed")])}
          onPointerDown={event => { if (event.button !== 0 || saving) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); dragging.current = { id: item.id, pointerId: event.pointerId, targetId: item.id }; setPointer({ x: event.clientX, y: event.clientY }); setDraggedId(item.id); }}
          onPointerMove={event => { if (dragging.current?.pointerId === event.pointerId) dragOver(event.clientX, event.clientY); }}
          onPointerUp={event => { if (dragging.current?.pointerId === event.pointerId) endDrag(true); }}
          onPointerCancel={() => endDrag()} onLostPointerCapture={() => endDrag()}>⠿</button></td>
        <td><input className={styles.position} type="number" min={1} max={items.length} defaultValue={index + 1} key={`${item.id}-${index}`} disabled={saving} aria-label={`${t("order.position")} ${item.name || t("order.unnamed")}`} onBlur={event => { const value = Number(event.currentTarget.value); if (Number.isInteger(value) && value >= 1 && value <= items.length) move(index, value - 1); else event.currentTarget.value = String(index + 1); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></td>
        <td><strong>{item.name || t("order.unnamed")}</strong><small>{item.quantity} × {Number(item.price).toLocaleString(formatLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</small></td>
        <td>{places.find(place => place.id === item.restaurantId)?.name ?? t("editor.noRestaurant")}</td>
        <td><div className={styles.controls}><button type="button" disabled={saving || index === 0} onClick={() => move(index, index - 1)} aria-label={t("order.up", [item.name || t("order.unnamed")])}>↑</button><button type="button" disabled={saving || index === items.length - 1} onClick={() => move(index, index + 1)} aria-label={t("order.down", [item.name || t("order.unnamed")])}>↓</button></div></td>
      </tr>)}</tbody></table></div>}
    {draggedId && pointer && (() => {
      const item = items.find(entry => entry.id === draggedId);
      if (!item) return null;
      return <div className={styles.dragPreview} aria-hidden="true" style={{ left: Math.max(8, Math.min(pointer.x + 14, window.innerWidth - 224)), top: pointer.y }}>
        <span className={styles.previewGrip}>⠿</span>
        <div><strong>{item.name || t("order.unnamed")}</strong><small>{item.quantity} × {Number(item.price).toLocaleString(formatLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</small></div>
      </div>;
    })()}
  </main>;
}
