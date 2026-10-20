"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Decimal from "decimal.js";
import { calculateBill } from "@/lib/billing";
import { createDraftBill } from "@/app/actions/bill";
import { baht, jsonBody, request } from "@/lib/client";
import { Icon } from "./Icons";
type Person = { id: string; name: string; isPayer: boolean };
type Item = {
  id: string;
  name: string;
  price: string;
  quantity: number;
  discountRate: string;
  isShared: boolean;
  includeSC: boolean;
  includeVat: boolean;
  consumers: string[];
  consumerQuantities?: Record<string, number>;
};
type Draft = {
  name: string;
  participants: Person[];
  items: Item[];
  serviceChargeValue: string;
  serviceChargeType: "%" | "฿";
  vatValue: string;
  vatType: "%" | "฿";
  vatIncludesSc: boolean;
  isPublic: boolean;
  passcode: string;
};
const uid = () => crypto.randomUUID();
const emptyItem = (): Item => ({
  id: uid(),
  name: "",
  price: "",
  quantity: 1,
  discountRate: "0",
  isShared: true,
  includeSC: true,
  includeVat: true,
  consumers: [],
});
const initial: Draft = {
  name: "",
  participants: [],
  items: [],
  serviceChargeValue: "0",
  serviceChargeType: "%",
  vatValue: "0",
  vatType: "%",
  vatIncludesSc: false,
  isPublic: true,
  passcode: "",
};
const dec = (v: string | number) => {
  try {
    const d = new Decimal(v || 0);
    return d.isFinite() && d.gte(0) ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
};
function sample(): Draft {
  const participants = [
    { id: "example-may", name: "เมย์", isPayer: false },
    { id: "example-boss", name: "บอส", isPayer: false },
    { id: "example-nut", name: "นัท", isPayer: false },
  ];
  return {
    ...initial,
    name: "มื้อเย็นกับเพื่อน",
    participants,
    items: [
      { ...emptyItem(), name: "อาหารจานกลาง", price: "480" },
      { ...emptyItem(), name: "เครื่องดื่ม", price: "240" },
    ],
  };
}
const draftKey = "wonglao-bill:new:v1";
export default function BillEditor({
  billId,
  demo = false,
}: {
  billId?: string;
  demo?: boolean;
}) {
  const { status } = useSession();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(Boolean(billId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [personName, setPersonName] = useState("");
  const [promptPay, setPromptPay] = useState("");
  const [billStatus, setBillStatus] = useState("DRAFT");
  const [locked, setLocked] = useState(false);
  const [savedDirty, setSavedDirty] = useState(false);
  const version = useRef(0);
  const idRef = useRef(billId);
  const saveGuard = useRef(false);
  const dirty = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (billId) return;
    try {
      const stored = localStorage.getItem(draftKey);
      const parsed = stored ? JSON.parse(stored) : null;
      setDraft(
        demo
          ? sample()
          : parsed &&
              Array.isArray(parsed.items) &&
              Array.isArray(parsed.participants)
            ? {
                ...parsed,
                items: parsed.items.length ? parsed.items : [emptyItem()],
              }
            : { ...initial, items: [emptyItem()] },
      );
    } catch {
      setDraft({ ...initial, items: [emptyItem()] });
    }
    setLoaded(true);
  }, [billId, demo]);
  useEffect(() => {
    if (!billId || status === "loading") return;
    if (status === "unauthenticated") {
      router.replace(
        `/login?callbackUrl=${encodeURIComponent(`/bills/${billId}/edit`)}`,
      );
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request<any>(`/api/bills/${billId}`)
      .then(({ bill }) => {
        if (!active) return;
        version.current = bill.version;
        setBillStatus(bill.status);
        if (bill.status === "CANCELLED") {
          router.replace(`/bill/${billId}`);
          return;
        }
        setLocked(
          bill.hasPaymentEvidence ||
            bill.participants.some(
              (p: any) => p.isPaid || Number(p.paidAmount) > 0,
            ),
        );
        setDraft({
          name: bill.name,
          participants: bill.participants,
          items: bill.items.map((i: any) => ({
            ...i,
            id: i.id,
            price: String(i.price),
            discountRate: String(i.discountRate),
            includeSC: i.includeSc,
            consumers: i.consumers.map((p: any) => p.id),
            consumerQuantities: i.consumerQuantities ?? undefined,
          })),
          serviceChargeValue: String(
            bill.serviceChargeValue ?? bill.serviceCharge,
          ),
          serviceChargeType: bill.serviceChargeType ?? "฿",
          vatValue: String(bill.vatValue ?? bill.vat),
          vatType: bill.vatType ?? "฿",
          vatIncludesSc: bill.vatIncludesSc ?? false,
          isPublic: bill.isPublic,
          passcode: bill.passcode ?? "",
        });
        setLoaded(true);
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
  }, [billId, status, router, attempt]);
  useEffect(() => {
    if (status === "authenticated")
      request<any>("/api/profile")
        .then((d) => setPromptPay(d.user?.promptPayId ?? ""))
        .catch(() => {});
  }, [status]);
  useEffect(() => {
    if (!loaded || billId || demo) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      setNotice(
        "เบราว์เซอร์ไม่อนุญาตให้เก็บฉบับร่าง กรุณาบันทึกก่อนออกจากหน้านี้",
      );
    }
  }, [draft, loaded, billId, demo]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current && idRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function update(data: Partial<Draft>) {
    dirty.current = true;
    setSavedDirty(true);
    setNotice("");
    setDraft((d) => ({ ...d, ...data }));
  }
  function updateItem(id: string, changes: Partial<Item>) {
    update({
      items: draft.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    });
  }
  const calcItems = draft.items.map((i) => ({
    ...i,
    price: dec(i.price),
    discountRate: Decimal.min(dec(i.discountRate), 100),
    quantity: Number.isInteger(i.quantity) ? Math.max(1, i.quantity) : 1,
  }));
  const net = (i: (typeof calcItems)[number]) =>
    i.price.mul(i.quantity).mul(new Decimal(1).minus(i.discountRate.div(100)));
  const subtotal = calcItems
    .reduce((s, i) => s.plus(net(i)), new Decimal(0))
    .toDecimalPlaces(2);
  const scBase = calcItems
    .filter((i) => i.includeSC)
    .reduce((s, i) => s.plus(net(i)), new Decimal(0));
  const sc = (
    draft.serviceChargeType === "%"
      ? scBase.mul(dec(draft.serviceChargeValue)).div(100)
      : dec(draft.serviceChargeValue)
  ).toDecimalPlaces(2);
  const vatBase = calcItems
    .filter((i) => i.includeVat)
    .reduce((s, i) => s.plus(net(i)), new Decimal(0))
    .plus(draft.vatIncludesSc ? sc : 0);
  const vat = (
    draft.vatType === "%"
      ? vatBase.mul(dec(draft.vatValue)).div(100)
      : dec(draft.vatValue)
  ).toDecimalPlaces(2);
  const total = subtotal.plus(sc).plus(vat);
  const result = calculateBill({
    items: calcItems,
    participants: draft.participants.map((p) => ({
      ...p,
      totalPayable: new Decimal(0),
    })),
    serviceCharge: sc,
    vat,
    grandTotal: total,
  });
  const hasUnassigned = draft.items.some(
    (i) =>
      !i.isShared &&
      !(i.consumerQuantities
        ? Object.values(i.consumerQuantities).some((q) => q > 0)
        : i.consumers.length),
  );
  const addPerson = () => {
    const name = personName.trim();
    if (!name) return;
    if (draft.participants.length >= 100) {
      setError("เพิ่มผู้ร่วมบิลได้สูงสุด 100 คน");
      return;
    }
    update({
      participants: [
        ...draft.participants,
        { id: uid(), name, isPayer: false },
      ],
    });
    setPersonName("");
  };
  function removePerson(id: string) {
    update({
      participants: draft.participants.filter((p) => p.id !== id),
      items: draft.items.map((i) => ({
        ...i,
        consumers: i.consumers.filter((c) => c !== id),
        consumerQuantities: i.consumerQuantities
          ? Object.fromEntries(
              Object.entries(i.consumerQuantities).filter(([p]) => p !== id),
            )
          : undefined,
      })),
    });
  }
  async function save(publish = false) {
    if (saveGuard.current || demo) return;
    setError("");
    setNotice("");
    if (!loaded) {
      setError("กรุณาโหลดบิลให้สำเร็จก่อนบันทึก");
      return;
    }
    if (!draft.name.trim()) {
      setError("ตั้งชื่อบิลก่อนบันทึก เช่น มื้อเย็นวันศุกร์");
      return;
    }
    if (!draft.isPublic && !/^\d{4,6}$/.test(draft.passcode)) {
      setError("ตั้ง PIN เป็นตัวเลข 4–6 หลัก");
      return;
    }
    if (
      publish &&
      (!draft.participants.length ||
        !draft.items.length ||
        total.lte(0) ||
        draft.items.some((i) => !i.name.trim() || !i.price) ||
        hasUnassigned)
    ) {
      setError("เพิ่มผู้ร่วมบิลและรายการให้ครบ แล้วเลือกผู้ร่วมจ่ายทุกรายการ");
      return;
    }
    if (
      draft.items.some(
        (i) =>
          !/^\d+(\.\d{1,2})?$/.test(i.price || "0") ||
          !Number.isInteger(i.quantity) ||
          i.quantity < 1 ||
          i.quantity > 999 ||
          dec(i.discountRate).gt(100),
      )
    ) {
      setError(
        "ตรวจสอบราคา (ทศนิยมไม่เกิน 2 ตำแหน่ง) จำนวน 1–999 และส่วนลด 0–100%",
      );
      return;
    }
    if ((publish || promptPay) && !/^(0\d{9}|\d{13})$/.test(promptPay)) {
      setError("ใส่ PromptPay เป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก");
      return;
    }
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent("/new")}`);
      return;
    }
    saveGuard.current = true;
    setSaving(true);
    try {
      const id = idRef.current ?? (await createDraftBill());
      idRef.current = id;
      if (promptPay)
        await request("/api/profile", {
          method: "PATCH",
          ...jsonBody({ promptPayId: promptPay }),
        });
      const payload = {
        ...draft,
        version: version.current,
        status: publish ? "PUBLISHED" : billStatus,
        isPublic: draft.isPublic,
        passcode: draft.isPublic ? null : draft.passcode,
        serviceCharge: sc.toFixed(2),
        vat: vat.toFixed(2),
        items: calcItems.map((i) => ({
          ...i,
          price: i.price.toFixed(2),
          discountRate: i.discountRate.toString(),
        })),
      };
      const saved = await request<{ version: number }>(`/api/bills/${id}`, {
        method: "PATCH",
        ...jsonBody(
          locked
            ? {
                version: version.current,
                name: draft.name,
                isPublic: draft.isPublic,
                passcode: draft.isPublic ? null : draft.passcode,
              }
            : payload,
        ),
      });
      version.current = saved.version;
      dirty.current = false;
      setSavedDirty(false);
      if (!billId)
        try {
          localStorage.setItem(
            draftKey,
            JSON.stringify({ ...initial, items: [] }),
          );
        } catch {}
      if (publish) {
        router.push(`/bill/${id}`);
      } else {
        setNotice("บันทึกฉบับร่างแล้ว");
        if (!billId) router.replace(`/bills/${id}/edit`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
      saveGuard.current = false;
    }
  }
  if (loading || !loaded)
    return (
      <div id="content" className="empty-state">
        <span className="spinner" />
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <button
              className="button secondary"
              onClick={() => setAttempt((v) => v + 1)}
            >
              โหลดใหม่
            </button>
          </>
        ) : (
          <p>กำลังเปิดบิล...</p>
        )}
      </div>
    );
  return (
    <div id="content">
      <div className="editor-top">
        <Link
          className="text-link muted"
          href="/"
          onClick={(e) => {
            if (
              dirty.current &&
              idRef.current &&
              !window.confirm(
                "มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?",
              )
            )
              e.preventDefault();
          }}
        >
          <Icon name="back" size={17} />
          บิลของฉัน
        </Link>
        <span className="save-indicator">
          <span className="live-dot" />
          {demo
            ? "บิลตัวอย่าง · ลองแก้ไขได้"
            : savedDirty
              ? billId
                ? "มีการแก้ไขที่ยังไม่บันทึก"
                : "เก็บฉบับร่างไว้ในเครื่องนี้"
              : "พร้อมแก้ไข"}
        </span>
      </div>
      <div className="page-heading">
        <div>
          <h1>
            {demo ? "ลองแบ่งมื้อนี้กัน" : billId ? "จัดการบิล" : "สร้างบิลใหม่"}
          </h1>
          <p>เพิ่มรายการ เลือกว่าใครกิน แล้วให้เราช่วยคิดยอด</p>
        </div>
        <span className="status status-draft">
          {billStatus === "PUBLISHED" ? "แชร์แล้ว" : "ฉบับร่าง"}
        </span>
      </div>
      {demo && (
        <div className="notice">
          ข้อมูลนี้เป็นตัวอย่างสำหรับทดลองคำนวณ การแก้ไขจะไม่บันทึกหรือส่งให้ใคร{" "}
          <Link href="/new">
            สร้างบิลของคุณเอง
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      )}
      {locked && (
        <div className="notice">
          บิลนี้มีการชำระเงินแล้ว แก้ไขได้เฉพาะชื่อและการแชร์
          เพื่อรักษายอดที่ตรวจสอบไว้
        </div>
      )}
      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel">
            <div className="panel-heading">
              <h2>มื้อนี้ชื่ออะไรดี</h2>
              <Icon name="receipt" />
            </div>
            <label className="field">
              <span>ชื่อบิล</span>
              <input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                maxLength={191}
                placeholder="เช่น มื้อเย็นวันศุกร์ / หมูกระทะแก๊งเรา"
              />
            </label>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                ใครอยู่ในโต๊ะนี้บ้าง{" "}
                <span className="inline-count">
                  {draft.participants.length}
                </span>
              </h2>
              <Icon name="users" />
            </div>
            <fieldset disabled={locked || saving}>
              <div className="people-list">
                {draft.participants.map((p, index) => (
                  <span className="person-chip" key={p.id}>
                    <span className={`avatar small tone-${index % 4}`}>
                      {p.name.slice(0, 1)}
                    </span>
                    {p.name}
                    <button
                      className="chip-remove"
                      aria-label={`นำ ${p.name} ออกจากบิล`}
                      onClick={() => removePerson(p.id)}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPerson();
                }}
              >
                <input
                  aria-label="ชื่อเพื่อน"
                  maxLength={191}
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="ชื่อเพื่อน เช่น เมย์"
                />
                <button
                  type="submit"
                  className="button secondary"
                  disabled={!personName.trim()}
                >
                  <Icon name="plus" size={17} />
                  เพิ่มเพื่อน
                </button>
              </form>
              {!draft.participants.length && (
                <p className="field-hint">
                  เพิ่มตัวคุณเองด้วย เพื่อให้ยอดแบ่งครบทุกคน
                </p>
              )}
            </fieldset>
          </section>
          <section className="panel item-panel">
            <div className="panel-heading">
              <h2>
                รายการในบิล{" "}
                <span className="inline-count">{draft.items.length}</span>
              </h2>
              <span className="muted">ราคาต่อหน่วย</span>
            </div>
            <fieldset disabled={locked || saving}>
              <div className="editor-items">
                {draft.items.map((item, index) => (
                  <div className="editor-item" key={item.id}>
                    <div className="item-index">{index + 1}</div>
                    <div className="item-fields">
                      <label className="field item-name">
                        <span>รายการ</span>
                        <input
                          aria-label={`ชื่อรายการ ${index + 1}`}
                          maxLength={191}
                          placeholder="ชื่ออาหาร / เครื่องดื่ม"
                          value={item.name}
                          onChange={(e) =>
                            updateItem(item.id, { name: e.target.value })
                          }
                        />
                      </label>
                      <label className="field item-price">
                        <span>ราคา (฿)</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={item.price}
                          placeholder="0.00"
                          aria-label={`ราคารายการ ${index + 1}`}
                          onChange={(e) =>
                            updateItem(item.id, { price: e.target.value })
                          }
                        />
                      </label>
                      <label className="field item-quantity">
                        <span>จำนวน</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="999"
                          value={item.quantity || ""}
                          aria-label={`จำนวนรายการ ${index + 1}`}
                          onChange={(e) =>
                            updateItem(item.id, {
                              quantity: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <button
                        className="icon-button remove-item"
                        aria-label={`นำรายการ ${index + 1} ออก`}
                        onClick={() =>
                          update({
                            items: draft.items.filter((i) => i.id !== item.id),
                          })
                        }
                      >
                        <Icon name="close" size={17} />
                      </button>
                    </div>
                    <div className="item-allocation">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={item.isShared}
                          onChange={(e) =>
                            updateItem(item.id, {
                              isShared: e.target.checked,
                              consumerQuantities: undefined,
                              consumers: [],
                            })
                          }
                        />
                        หารทุกคน
                      </label>
                      {!item.isShared && (
                        <div className="allocation-chips">
                          {draft.participants.length ? (
                            draft.participants.map((p) => (
                              <label
                                className={
                                  item.consumers.includes(p.id)
                                    ? "allocation-chip selected"
                                    : "allocation-chip"
                                }
                                key={p.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.consumers.includes(p.id)}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      consumers: e.target.checked
                                        ? [...item.consumers, p.id]
                                        : item.consumers.filter(
                                            (c) => c !== p.id,
                                          ),
                                      consumerQuantities: undefined,
                                    })
                                  }
                                />
                                {p.name}
                              </label>
                            ))
                          ) : (
                            <span className="field-hint">
                              เพิ่มเพื่อนก่อนเลือกรายคน
                            </span>
                          )}
                        </div>
                      )}
                      <span className="item-net">
                        ฿ {baht(net(calcItems[index]))}
                      </span>
                    </div>
                    <details className="item-details">
                      <summary>ส่วนลดและการแบ่งเพิ่มเติม</summary>
                      <div className="details-fields">
                        <label className="field">
                          <span>ส่วนลด (%)</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discountRate}
                            onChange={(e) =>
                              updateItem(item.id, {
                                discountRate: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={item.includeSC}
                            onChange={(e) =>
                              updateItem(item.id, {
                                includeSC: e.target.checked,
                              })
                            }
                          />
                          คิด Service charge
                        </label>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={item.includeVat}
                            onChange={(e) =>
                              updateItem(item.id, {
                                includeVat: e.target.checked,
                              })
                            }
                          />
                          คิด VAT
                        </label>
                      </div>
                      {!item.isShared && draft.participants.length > 0 && (
                        <div className="custom-quantities">
                          <p className="field-hint">
                            แบ่งตามสัดส่วน: ระบุจำนวนที่แต่ละคนกิน
                            ระบบคิดตามสัดส่วนรวม
                          </p>
                          {draft.participants.map((p) => (
                            <label className="field" key={p.id}>
                              <span>{p.name}</span>
                              <input
                                type="number"
                                min="0"
                                max="999"
                                step="1"
                                value={item.consumerQuantities?.[p.id] ?? 0}
                                onChange={(e) => {
                                  const cq = {
                                    ...item.consumerQuantities,
                                    [p.id]: Number(e.target.value),
                                  };
                                  updateItem(item.id, {
                                    consumerQuantities: cq,
                                    consumers: Object.entries(cq)
                                      .filter(([, q]) => q > 0)
                                      .map(([id]) => id),
                                  });
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </details>
                  </div>
                ))}
              </div>
              <button
                className="add-item-button"
                disabled={draft.items.length >= 300}
                onClick={() => update({ items: [...draft.items, emptyItem()] })}
              >
                <Icon name="plus" size={18} />
                เพิ่มรายการ
              </button>
            </fieldset>
            <div className="subtotal-line">
              <span>รวมรายการหลังส่วนลด</span>
              <b>฿ {baht(subtotal)}</b>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>ค่าใช้จ่ายเพิ่มเติม</h2>
              <span className="muted">ถ้ามี</span>
            </div>
            <fieldset disabled={locked || saving}>
              <div className="extras-grid">
                {(["serviceCharge", "vat"] as const).map((key) => (
                  <label className="field" key={key}>
                    <span>{key === "vat" ? "VAT" : "Service charge"}</span>
                    <div className="unit-field">
                      <input
                        aria-label={key === "vat" ? "VAT" : "Service charge"}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft[`${key}Value`]}
                        onChange={(e) =>
                          update({ [`${key}Value`]: e.target.value })
                        }
                      />
                      <select
                        aria-label={`หน่วย ${key}`}
                        value={draft[`${key}Type`]}
                        onChange={(e) =>
                          update({ [`${key}Type`]: e.target.value })
                        }
                      >
                        <option value="%">%</option>
                        <option value="฿">฿</option>
                      </select>
                    </div>
                  </label>
                ))}
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.vatIncludesSc}
                  onChange={(e) => update({ vatIncludesSc: e.target.checked })}
                />
                คิด VAT รวม Service charge
              </label>
            </fieldset>
          </section>
        </div>
        <aside className="summary-sidebar">
          <section className="summary-panel" id="summary">
            <div className="panel-heading">
              <h2>สรุปมื้อนี้</h2>
              <span className="summary-live">
                <span className="live-dot" />
                คำนวณทันที
              </span>
            </div>
            <div className="summary-total">
              <span>ยอดรวมทั้งบิล</span>
              <strong>
                <small>฿</small> {baht(total)}
              </strong>
              <p>
                {draft.items.length} รายการ · {draft.participants.length} คน
              </p>
            </div>
            <div className="summary-breakdown">
              <div>
                <span>ค่าอาหารและเครื่องดื่ม</span>
                <b>{baht(subtotal)}</b>
              </div>
              <div>
                <span>Service charge</span>
                <b>{baht(sc)}</b>
              </div>
              <div>
                <span>VAT</span>
                <b>{baht(vat)}</b>
              </div>
            </div>
            <div className="per-person">
              <h3>แต่ละคนจ่าย</h3>
              {result.participants.length ? (
                result.participants.map((p, index) => (
                  <div className="person-total" key={p.id}>
                    <span className={`avatar small tone-${index % 4}`}>
                      {p.name.slice(0, 1)}
                    </span>
                    <span>{p.name}</span>
                    <b>
                      {hasUnassigned
                        ? "รอเลือกรายการ"
                        : `฿ ${baht(p.totalPayable)}`}
                    </b>
                  </div>
                ))
              ) : (
                <p className="field-hint">เพิ่มเพื่อนเพื่อดูยอดรายคน</p>
              )}
            </div>
            {hasUnassigned && (
              <p className="warning">มีรายการที่ยังไม่ได้เลือกผู้ร่วมจ่าย</p>
            )}
            <div className="payment-settings">
              <label className="field">
                <span>PromptPay ผู้รับเงิน</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="เบอร์มือถือ / เลขประจำตัว"
                  value={promptPay}
                  maxLength={13}
                  onChange={(e) =>
                    setPromptPay(e.target.value.replace(/\D/g, ""))
                  }
                  disabled={saving}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!draft.isPublic}
                  disabled={saving}
                  onChange={(e) => update({ isPublic: !e.target.checked })}
                />
                <Icon name="shield" size={16} />
                ใช้ PIN ก่อนเปิดบิล
              </label>
              {!draft.isPublic && (
                <label className="field">
                  <span>PIN 4–6 หลัก</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={draft.passcode}
                    onChange={(e) =>
                      update({ passcode: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </label>
              )}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="success" role="status">
                {notice}
              </p>
            )}
            {demo ? (
              <Link href="/new" className="button primary full-width">
                สร้างบิลของฉัน
                <Icon name="arrow" size={18} />
              </Link>
            ) : (
              <>
                <button
                  className="button primary full-width"
                  onClick={() => save(true)}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="spinner" />
                  ) : (
                    <Icon name="link" size={18} />
                  )}
                  บันทึกและสร้างลิงก์แชร์
                </button>
                <button
                  className="button secondary full-width"
                  onClick={() => save(false)}
                  disabled={saving}
                >
                  บันทึก{billStatus === "DRAFT" ? "ฉบับร่าง" : "การแก้ไข"}
                </button>
              </>
            )}
            <p className="summary-footnote">
              ยอดเงินจริงตรวจสอบและคำนวณอีกครั้งเมื่อบันทึก
            </p>
          </section>
        </aside>
      </div>
      <div className="mobile-summary">
        <div>
          <span>รวมมื้อนี้</span>
          <strong>฿ {baht(total)}</strong>
        </div>
        <a className="button primary" href="#summary">
          ดูยอดรายคน
          <Icon name="arrow" size={16} />
        </a>
      </div>
    </div>
  );
}
