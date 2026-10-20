"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import generatePayload from "promptpay-qr";
import Decimal from "decimal.js";
import { baht, request, jsonBody } from "@/lib/client";
import { Icon } from "./Icons";
type Data = {
  bill: {
    name: string;
    owner: { name: string | null; promptPayId: string | null };
  };
  participant: {
    name: string;
    totalPayable: string;
    paidAmount: string;
    isPaid: boolean;
    payslipUrl: string | null;
    evidenceStatus: string | null;
  };
  canManage: boolean;
};
export default function Payment({ id, pid }: { id: string; pid: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const [reason, setReason] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const endpoint = `/api/bills/${id}/participants/${pid}`;
  const headers = useCallback(() => {
    let token = "";
    try {
      token = sessionStorage.getItem(`payment:${id}:${pid}`) ?? "";
    } catch {}
    return { "x-payment-token": token };
  }, [id, pid]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await request<Data>(endpoint, { headers: headers() }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, headers]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const url = data?.participant.payslipUrl;
    if (!url) {
      setPreview("");
      return;
    }
    let active = true;
    let blob = "";
    fetch(url, { headers: headers(), cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("เปิดรูปสลิปไม่สำเร็จ");
        return r.blob();
      })
      .then((b) => {
        if (active) {
          blob = URL.createObjectURL(b);
          setPreview(blob);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [data, headers]);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > 4 * 1024 * 1024) {
      setError("เลือกรูปสลิปขนาดไม่เกิน 4 MB");
      return;
    }
    setWorking(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await request<any>(endpoint, {
        method: "POST",
        headers: headers(),
        body: fd,
      });
      await load();
      setMessage(
        result.status === "needs_review"
          ? "รับสลิปแล้ว รอผู้สร้างบิลตรวจสอบ"
          : "ตรวจสอบสลิปแล้ว อัปเดตยอดชำระเรียบร้อย",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function review(reverse = false) {
    setError("");
    setMessage("");
    if (reason.trim().length < 3) {
      setError("ระบุเหตุผลอย่างน้อย 3 ตัวอักษรเพื่อเก็บประวัติการตรวจสอบ");
      return;
    }
    if (
      reverse &&
      !window.confirm(
        "ย้อนยอดชำระของรายการนี้หรือไม่? หลักฐานเดิมจะยังเก็บไว้ในประวัติ",
      )
    )
      return;
    setWorking(true);
    try {
      const payload = jsonBody({ reason });
      await request(endpoint, {
        method: reverse ? "DELETE" : "PATCH",
        ...payload,
        headers: { ...payload.headers, ...headers() },
      });
      setReason("");
      await load();
      setMessage(
        reverse ? "ย้อนยอดชำระแล้ว โดยเก็บหลักฐานเดิมไว้" : "ยืนยันยอดชำระแล้ว",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `PromptPay-${id}.png`;
    link.click();
  }
  if (loading && !data)
    return (
      <div id="content" className="empty-state" role="status">
        <span className="spinner" />
        กำลังเปิดยอดชำระ...
      </div>
    );
  if (!data)
    return (
      <div id="content" className="empty-state">
        <Icon name="shield" size={35} />
        <h1>เปิดยอดชำระไม่ได้</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <Link className="button primary" href={`/bill/${id}`}>
          เปิดจากหน้าบิลอีกครั้ง
        </Link>
        <button className="button secondary" onClick={load}>
          ลองใหม่
        </button>
      </div>
    );
  const p = data.participant;
  const remaining = Decimal.max(
    new Decimal(p.totalPayable).minus(p.paidAmount),
    0,
  );
  let qr = "";
  const receiver = data.bill.owner.promptPayId;
  try {
    if (receiver && /^(0\d{9}|\d{13})$/.test(receiver) && remaining.gt(0))
      qr = generatePayload(receiver, { amount: remaining.toNumber() });
  } catch {}
  return (
    <div id="content" className="payment-page">
      <Link className="text-link muted" href={`/bill/${id}`}>
        <Icon name="back" size={16} />
        กลับไปดูทั้งบิล
      </Link>
      <div className="pay-heading">
        <h1>{p.name} จ่ายมื้อนี้</h1>
        <p>
          {data.bill.name} · รับเงินโดย {data.bill.owner.name || "ผู้สร้างบิล"}
        </p>
      </div>
      <section className="panel qr-panel">
        {p.isPaid ? (
          <>
            <span className="status status-published">
              <Icon name="check" size={16} />
              ยืนยันชำระครบแล้ว
            </span>
            <strong>฿ {baht(p.paidAmount)}</strong>
            <p>ขอบคุณที่เคลียร์มื้อนี้ด้วยกัน</p>
          </>
        ) : (
          <>
            <p>ยอดคงเหลือของคุณ</p>
            <strong>฿ {baht(remaining)}</strong>
            <p>
              ยอดเต็ม ฿ {baht(p.totalPayable)} · ชำระแล้ว ฿ {baht(p.paidAmount)}
            </p>
            {qr ? (
              <>
                <div ref={qrRef} className="qr-box">
                  <QRCodeCanvas
                    value={qr}
                    size={218}
                    marginSize={4}
                    level="M"
                    title={`PromptPay ${remaining.toFixed(2)} บาท`}
                  />
                </div>
                <div className="qr-label">PromptPay</div>
                <p>{receiver}</p>
                <button
                  className="button secondary full-width"
                  onClick={downloadQr}
                >
                  บันทึก QR เพื่อโอนเงิน
                </button>
                <p className="field-hint">
                  ตรวจสอบชื่อผู้รับและยอดเงินในแอปธนาคารก่อนโอน
                </p>
              </>
            ) : (
              <p className="warning">
                ผู้สร้างบิลยังไม่ได้ตั้งค่า PromptPay ที่ถูกต้อง
                กรุณาติดต่อผู้สร้างบิลก่อนโอน
              </p>
            )}
          </>
        )}
      </section>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <h2>หลักฐานการชำระ</h2>
          <Icon name="upload" />
        </div>
        {p.evidenceStatus && (
          <p
            className={p.evidenceStatus === "VERIFIED" ? "success" : "warning"}
          >
            {p.evidenceStatus === "VERIFIED"
              ? "สลิปได้รับการยืนยันแล้ว"
              : "สลิปรอเจ้าของบิลตรวจสอบ ยังไม่นับเป็นยอดชำระ"}
          </p>
        )}
        {preview && (
          <img
            className="slip-preview"
            src={preview}
            alt="หลักฐานการโอนเงินของรายการนี้"
          />
        )}
        {!p.isPaid && (
          <label className="file-label">
            <Icon name="upload" size={26} />
            <span>
              {working ? "กำลังตรวจสอบสลิป..." : "แนบรูปสลิปหลังโอนเงิน"}
            </span>
            <small>JPG, PNG, WebP หรือ GIF · ไม่เกิน 4 MB</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={working || loading}
              onChange={upload}
              aria-label="เลือกภาพสลิปโอนเงิน"
            />
          </label>
        )}
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="text-link"
          disabled={working || loading}
          style={{
            background: "none",
            border: 0,
            marginTop: 14,
            minHeight: 35,
          }}
          onClick={load}
        >
          อัปเดตสถานะล่าสุด
        </button>
      </section>
      {data.canManage && p.evidenceStatus && (
        <section className="panel review-panel" style={{ marginTop: 20 }}>
          <h2>สำหรับผู้สร้างบิล</h2>
          <p className="field-hint">
            ตรวจสอบหลักฐานก่อนยืนยัน ทุกการดำเนินการเก็บเหตุผลไว้
          </p>
          <label className="field">
            <span>เหตุผลในการดำเนินการ</span>
            <textarea
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ตรวจสอบยอดเข้าบัญชีเรียบร้อยแล้ว"
            />
          </label>
          {p.evidenceStatus === "NEEDS_REVIEW" && (
            <button
              className="button primary full-width"
              disabled={working}
              onClick={() => review(false)}
            >
              ยืนยันการชำระ
            </button>
          )}
          <button
            className="button button-danger full-width"
            disabled={working}
            onClick={() => review(true)}
          >
            ย้อนยอดชำระ (เก็บหลักฐานเดิม)
          </button>
        </section>
      )}
    </div>
  );
}
