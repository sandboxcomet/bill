"use client";
import Link from "next/link";
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
const labels: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "แชร์แล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};
export default function Dashboard() {
  const { data: session, status } = useSession();
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
      <section className="dashboard-intro">
        <div className="intro-copy">
          <h1>
            อิ่มด้วยกัน
            <br />
            <span>แบ่งกันให้ลงตัว.</span>
          </h1>
          <p>
            ใครกินอะไร จ่ายเท่านั้น
            <br />
            จัดการบิลมื้อนี้ให้จบ แล้วไปสนุกกันต่อ
          </p>
          <div className="button-row">
            <Link href="/new" className="button primary">
              <Icon name="plus" />
              สร้างบิลใหม่
            </Link>
            <Link href="/demo" className="text-link">
              ลองแบ่งบิลตัวอย่าง
              <Icon name="arrow" size={17} />
            </Link>
          </div>
          <div className="intro-note">
            <Icon name="shield" size={16} />
            ผู้ร่วมบิลเปิดลิงก์ดูยอดและส่งสลิปได้เลย
          </div>
        </div>
        <div className="receipt-scene" aria-label="ตัวอย่างการแบ่งบิล">
          <div className="receipt-paper">
            <div className="receipt-heading">
              <Icon name="receipt" size={22} />
              <span>มื้อเย็นกับเพื่อน</span>
              <span className="example-tag">ตัวอย่าง</span>
            </div>
            <div className="receipt-line">
              <span>อาหารจานกลาง</span>
              <b>฿ 480.00</b>
            </div>
            <div className="receipt-line">
              <span>เครื่องดื่ม</span>
              <b>฿ 240.00</b>
            </div>
            <div className="receipt-divider" />
            <div className="receipt-total">
              <span>รวมมื้อนี้</span>
              <strong>฿ 720.00</strong>
            </div>
            <div className="receipt-people">
              {["เมย์", "บอส", "นัท"].map((p, i) => (
                <div key={p}>
                  <span className={`avatar tone-${i}`}>{p.slice(0, 1)}</span>
                  <span>{p}</span>
                  <b>240.00</b>
                </div>
              ))}
            </div>
            <div className="receipt-end">
              <Icon name="check" size={15} />
              แบ่งครบ พอดีทุกบาท
            </div>
          </div>
          <div className="scene-label">
            <span className="live-dot" />
            บิลเดียว แบ่งได้ตามที่กินจริง
          </div>
        </div>
      </section>
      <section className="bills-section">
        <div className="section-title-row">
          <div>
            <h2>
              บิลของ
              {session?.user?.name
                ? ` ${session.user.name.split(" ")[0]}`
                : "ฉัน"}
            </h2>
            <p>ทุกมื้อที่สร้างไว้ กลับมาจัดการต่อได้ที่นี่</p>
          </div>
          <span className="count-label">{bills.length} บิล</span>
        </div>
        <div className="list-toolbar">
          <div className="tabs" aria-label="กรองสถานะบิล">
            {[
              ["ALL", "ทั้งหมด"],
              ["DRAFT", "ฉบับร่าง"],
              ["PUBLISHED", "แชร์แล้ว"],
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
              aria-label="ค้นหาชื่อบิล"
              placeholder="ค้นหาชื่อบิล..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <div className="empty-state" role="status">
            <span className="spinner" />
            กำลังโหลดบิลของคุณ...
          </div>
        ) : error ? (
          <div className="empty-state">
            <p className="error" role="alert">
              {error}
            </p>
            <button
              className="button secondary"
              onClick={() => setAttempt((v) => v + 1)}
            >
              ลองใหม่
            </button>
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
                  <h3>{b.name || "บิลที่ยังไม่ได้ตั้งชื่อ"}</h3>
                  <p>
                    {new Date(b.createdAt).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                    })}
                    <span>·</span>
                    {b._count.participants} คน<span>·</span>
                    {b._count.items} รายการ
                  </p>
                </div>
                <span className={`status status-${b.status.toLowerCase()}`}>
                  {labels[b.status] || b.status}
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
                ? "ไม่พบบิลที่ค้นหา"
                : filter !== "ALL"
                  ? "ยังไม่มีบิลในสถานะนี้"
                  : "มื้อแรกของคุณ เริ่มที่นี่"}
            </h3>
            <p>
              {status === "unauthenticated"
                ? "ลองสร้างบิลได้ทันที เข้าสู่ระบบเมื่อต้องการบันทึกและแชร์"
                : search
                  ? "ลองค้นหาด้วยชื่ออื่น"
                  : filter !== "ALL"
                    ? "เลือกทั้งหมดเพื่อดูบิลสถานะอื่น"
                    : "เพิ่มรายการ ชวนเพื่อน แล้วแบ่งยอดให้ลงตัว"}
            </p>
            <Link className="button secondary" href="/new">
              <Icon name="plus" size={17} />
              สร้างบิลใหม่
            </Link>
            {status === "unauthenticated" && (
              <Link href="/login" className="text-link">
                เข้าสู่ระบบเพื่อดูบิลที่บันทึกไว้
              </Link>
            )}
          </div>
        )}
      </section>
      <div className="workflow-note">
        <span>
          <Icon name="receipt" size={17} />
          เพิ่มรายการ
        </span>
        <Icon name="arrow" size={14} />
        <span>
          <Icon name="users" size={17} />
          เลือกว่าใครกิน
        </span>
        <Icon name="arrow" size={14} />
        <span>
          <Icon name="link" size={17} />
          แชร์ลิงก์จ่าย
        </span>
      </div>
    </div>
  );
}
