"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Decimal from "decimal.js";
import { baht } from "@/lib/client";
import { Icon } from "./Icons";
type Bill = {
  id: string;
  name: string;
  userId: number;
  grandTotal: string;
  serviceCharge: string;
  vat: string;
  status: string;
  createdAt: string;
  isPublic: boolean;
  owner: { name: string | null };
  participants: {
    id: string;
    name: string;
    totalPayable: string;
    isPaid: boolean;
    isPayer: boolean;
    paymentUrl: string;
    paymentToken: string;
  }[];
  items: {
    id: string;
    name: string;
    price: string;
    quantity: number;
    discountRate: string;
    isShared: boolean;
    consumers: { id: string; name: string }[];
    consumerQuantities: Record<string, number> | null;
  }[];
};
export default function SharedBill({ id }: { id: string }) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const load = useCallback(
    async (passcode = "") => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/bill?id=${encodeURIComponent(id)}`, {
          headers: { "x-bill-passcode": passcode },
          cache: "no-store",
        });
        const d = await r.json();
        if (r.status === 403) {
          setPinRequired(true);
          if (passcode) setError("PIN ไม่ถูกต้อง กรุณาตรวจสอบกับผู้สร้างบิล");
        } else if (!r.ok) {
          throw new Error(
            r.status === 404
              ? "ไม่พบบิล หรือบิลนี้ยังไม่ได้เปิดแชร์"
              : d.error || "เปิดบิลไม่สำเร็จ กรุณาลองใหม่",
          );
        } else {
          setBill(d.bill);
          setPinRequired(false);
          if (passcode)
            try {
              sessionStorage.setItem(
                `pin:${id}`,
                JSON.stringify({ pin: passcode, expires: Date.now() + 600000 }),
              );
            } catch {}
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    let cached = "";
    try {
      const raw = JSON.parse(sessionStorage.getItem(`pin:${id}`) || "null");
      if (raw?.expires > Date.now()) cached = raw.pin;
    } catch {}
    void load(cached);
  }, [id, load]);
  async function share() {
    setSharing(true);
    setMessage("");
    try {
      if (navigator.share) {
        await navigator.share({
          title: bill?.name || "บิลของเรา",
          text: "เปิดดูยอดของคุณและโอนผ่าน PromptPay",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage("คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessage(`คัดลอกลิงก์นี้เพื่อแชร์: ${window.location.href}`);
    } finally {
      setSharing(false);
    }
  }
  function pay(p: Bill["participants"][number]) {
    setError("");
    try {
      sessionStorage.setItem(`payment:${id}:${p.id}`, p.paymentToken);
      router.push(p.paymentUrl);
    } catch {
      setError(
        "กรุณาอนุญาตการจัดเก็บข้อมูลในเบราว์เซอร์ เพื่อเปิดหน้าจ่ายเงิน",
      );
    }
  }
  if (loading)
    return (
      <div id="content" className="empty-state" role="status">
        <span className="spinner" />
        กำลังเปิดบิล...
      </div>
    );
  if (pinRequired)
    return (
      <form
        id="content"
        className="panel pin-gate"
        onSubmit={(e) => {
          e.preventDefault();
          void load(pin);
        }}
      >
        <Icon name="shield" size={36} />
        <h1>บิลนี้สำหรับคนในโต๊ะ</h1>
        <p>ใส่ PIN จากผู้สร้างบิลเพื่อดูยอดของคุณ</p>
        <label className="field">
          <span>PIN 4–6 หลัก</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            minLength={4}
            autoFocus
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width">
          เปิดดูบิล
          <Icon name="arrow" size={17} />
        </button>
      </form>
    );
  if (!bill)
    return (
      <div id="content" className="empty-state">
        <Icon name="receipt" size={36} />
        <h1>เปิดบิลไม่ได้</h1>
        <p className="error" role="alert">
          {error || "ไม่พบบิลนี้"}
        </p>
        <button className="button secondary" onClick={() => load()}>
          ลองเปิดอีกครั้ง
        </button>
        <Link href="/" className="text-link">
          กลับหน้าหลัก
        </Link>
      </div>
    );
  const owner = String(session?.user?.id) === String(bill.userId);
  const cancelled = bill.status === "CANCELLED";
  return (
    <div id="content" className="share-layout">
      <Link href="/" className="text-link muted">
        <Icon name="back" size={16} />
        กลับหน้าบิล
      </Link>
      <div className="share-title">
        <h1>{bill.name || "บิลของเรา"}</h1>
        <p>
          {new Date(bill.createdAt).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · โดย {bill.owner.name || "ผู้สร้างบิล"}
        </p>
      </div>
      {cancelled && (
        <div className="warning">
          บิลนี้ถูกยกเลิกแล้ว ไม่สามารถรับชำระเงินได้
        </div>
      )}
      {bill.status === "DRAFT" && (
        <div className="notice">
          บิลนี้ยังเป็นฉบับร่าง เฉพาะเจ้าของที่เปิดดูได้
        </div>
      )}
      <div className="share-actions">
        {!cancelled && bill.status === "PUBLISHED" && (
          <button className="button primary" disabled={sharing} onClick={share}>
            <Icon name="link" size={18} />
            แชร์บิลให้เพื่อน
          </button>
        )}
        {owner && !cancelled && (
          <Link className="button secondary" href={`/bills/${id}/edit`}>
            แก้ไขบิล
          </Link>
        )}
        <button className="button secondary" onClick={() => window.print()}>
          พิมพ์บิล
        </button>
      </div>
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="share-receipt">
        <div className="share-total">
          <p>ยอดรวมมื้อนี้</p>
          <strong>฿ {baht(bill.grandTotal)}</strong>
          <p>
            {bill.participants.length} คน · {bill.items.length} รายการ
          </p>
        </div>
        <div className="panel-heading">
          <h2>ยอดของแต่ละคน</h2>
          <Icon name="users" size={19} />
        </div>
        {bill.participants.map((p, i) => (
          <div className="participant-row" key={p.id}>
            <span className={`avatar tone-${i % 4}`}>{p.name.slice(0, 1)}</span>
            <div className="participant-info">
              <h3>{p.name}</h3>
              <p>{p.isPaid ? "ยืนยันชำระแล้ว" : "รอชำระเงิน"}</p>
            </div>
            <b className="participant-amount">฿ {baht(p.totalPayable)}</b>
            {!cancelled && bill.status === "PUBLISHED" && (
              <button
                className={`button ${p.isPaid ? "secondary" : "primary"}`}
                onClick={() => pay(p)}
              >
                {p.isPaid ? (
                  <Icon name="check" size={15} />
                ) : (
                  <Icon name="wallet" size={15} />
                )}{" "}
                {p.isPaid ? "ดูรายการ" : "ดูยอด / จ่าย"}
              </button>
            )}
          </div>
        ))}
        <div className="share-items">
          <h2>รายละเอียดรายการ</h2>
          {bill.items.map((i) => (
            <div className="share-item-line" key={i.id}>
              <div>
                {i.name} × {i.quantity}
                <small>
                  {i.isShared
                    ? "หารทุกคน"
                    : i.consumers.map((p) => p.name).join(", ")}
                  {Number(i.discountRate) > 0 ? ` · ลด ${i.discountRate}%` : ""}
                </small>
              </div>
              <b>
                {baht(
                  new Decimal(i.price)
                    .mul(i.quantity)
                    .mul(
                      new Decimal(1).minus(
                        new Decimal(i.discountRate).div(100),
                      ),
                    ),
                )}
              </b>
            </div>
          ))}
          <div className="share-item-line">
            <span>Service charge</span>
            <b>{baht(bill.serviceCharge)}</b>
          </div>
          <div className="share-item-line">
            <span>VAT</span>
            <b>{baht(bill.vat)}</b>
          </div>
        </div>
        <p className="summary-footnote">
          <Icon name="shield" size={12} />{" "}
          สลิปอ่านได้เฉพาะผู้มีสิทธิ์ในรายการจ่ายนี้
        </p>
      </section>
    </div>
  );
}
