import { Decimal } from "decimal.js";
export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
  ) {
    super(message);
  }
}

function promptPayNumber(value: string) {
  const digits = value.replace(/[\s()+-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("0066") && digits.length === 13)
    return `0${digits.slice(4)}`;
  if (digits.startsWith("66") && digits.length === 11)
    return `0${digits.slice(2)}`;
  return digits;
}

export function inspectSlip(result: unknown, expectedReceiver: string | null) {
  const data = (result as { success?: boolean; data?: any })?.data;
  if (!(result as { success?: boolean })?.success || !data?.rawSlip) {
    throw new PaymentError("ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่");
  }
  const raw = data.rawSlip;
  if (
    typeof raw.transRef !== "string" ||
    !raw.transRef.trim() ||
    raw.transRef.length > 180
  ) {
    throw new PaymentError("สลิปไม่มีเลขอ้างอิงที่ตรวจสอบได้");
  }
  const currency = raw.amount?.local?.currency;
  if (currency !== "THB" || raw.countryCode !== "TH")
    throw new PaymentError("รองรับสลิปเงินบาทในประเทศไทยเท่านั้น");
  let amount: Decimal;
  try {
    amount = new Decimal(data.amountInSlip);
  } catch {
    throw new PaymentError("ยอดเงินในสลิปไม่ถูกต้อง");
  }
  if (
    !amount.isFinite() ||
    amount.lte(0) ||
    amount.decimalPlaces() > 2 ||
    amount.gt("9999999999999999.99")
  ) {
    throw new PaymentError("ยอดเงินในสลิปไม่ถูกต้อง");
  }
  const parsedDate = typeof raw.date === "string" ? new Date(raw.date) : null;
  const transactedAt =
    parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
  if (transactedAt && transactedAt.getTime() > Date.now() + 5 * 60 * 1000)
    throw new PaymentError("วันที่ในสลิปไม่ถูกต้อง");
  const proxy = raw.receiver?.account?.proxy;
  const actual =
    typeof proxy?.account === "string" &&
    ["MSISDN", "NATID"].includes(proxy.type)
      ? promptPayNumber(proxy.account)
      : null;
  const expected = expectedReceiver ? promptPayNumber(expectedReceiver) : null;
  if (actual && expected && actual !== expected)
    throw new PaymentError("ผู้รับเงินในสลิปไม่ตรงกับรายการนี้");
  // Masked account numbers are not proof of ownership. They require an owner review.
  return {
    reference: raw.transRef.trim(),
    amount,
    transactedAt,
    receiverMatch: Boolean(actual && expected && actual === expected),
  };
}
