"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { request, jsonBody } from "@/lib/client";
import { Icon } from "@/components/Icons";
export default function Settings() {
  const { status } = useSession();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError("");
    request<any>("/api/profile")
      .then((d) => setValue(d.user.promptPayId ?? ""))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, attempt]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!/^(0\d{9}|\d{13})$/.test(value)) {
      setError("ใส่เบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก");
      return;
    }
    setSaving(true);
    try {
      await request("/api/profile", {
        method: "PATCH",
        ...jsonBody({ promptPayId: value }),
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div id="content" className="settings-page">
      <h1>บัญชีรับเงิน</h1>
      <p>ตั้งค่า PromptPay สำหรับให้เพื่อนโอนยอดในบิล</p>
      <section className="panel">
        {status === "loading" ? (
          <p role="status">กำลังตรวจสอบบัญชี...</p>
        ) : status !== "authenticated" ? (
          <>
            <h2>เข้าสู่ระบบเพื่อตั้งค่าบัญชี</h2>
            <p className="field-hint">หมายเลขรับเงินจะผูกกับบัญชีของคุณ</p>
            <Link
              href="/login?callbackUrl=/settings"
              className="button primary full-width"
            >
              เข้าสู่ระบบ
            </Link>
          </>
        ) : loading ? (
          <p role="status">กำลังโหลด...</p>
        ) : (
          <form onSubmit={save}>
            <div className="panel-heading">
              <h2>PromptPay</h2>
              <Icon name="wallet" />
            </div>
            <p className="field-hint">
              ใช้เบอร์มือถือหรือเลขประจำตัวที่ลงทะเบียน PromptPay แล้ว
            </p>
            <label className="field">
              <span>หมายเลข PromptPay</span>
              <input
                inputMode="numeric"
                value={value}
                maxLength={13}
                onChange={(e) => {
                  setValue(e.target.value.replace(/\D/g, ""));
                  setSaved(false);
                }}
                placeholder="หมายเลขรับเงิน"
                required
              />
            </label>
            <button disabled={saving} className="button primary full-width">
              {saving ? "กำลังบันทึก..." : "บันทึกบัญชีรับเงิน"}
            </button>
            {saved && (
              <p className="success" role="status">
                บันทึกหมายเลขรับเงินแล้ว
              </p>
            )}
          </form>
        )}
        {error && (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <button
              className="text-link"
              onClick={() => setAttempt((v) => v + 1)}
            >
              โหลดข้อมูลใหม่
            </button>
          </>
        )}
      </section>
      <p className="field-hint">
        เมื่อเปลี่ยนหมายเลข QR ของบิลที่แชร์ไว้จะใช้หมายเลขใหม่
        ตรวจสอบให้ถูกต้องก่อนเปลี่ยน
      </p>
    </div>
  );
}
