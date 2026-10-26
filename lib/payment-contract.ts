import { Decimal } from "decimal.js";
export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
  ) {
    super(message);
  }
}

function promptPayNumber(value: string, type: "MSISDN" | "NATID") {
  const digits = value.replace(/[\s()+-]/g, "");
  if (type === "MSISDN" && digits.startsWith("0066") && digits.length === 13)
    return `0${digits.slice(4)}`;
  if (type === "MSISDN" && digits.startsWith("66") && digits.length === 11)
    return `0${digits.slice(2)}`;
  return digits;
}

function matchesReceiver(account: unknown, type: unknown, expectedReceiver: string | null) {
  if (typeof account !== "string" || !expectedReceiver ||
      (type !== "MSISDN" && type !== "NATID")) return false;
  const actual = promptPayNumber(account, type);
  const expected = promptPayNumber(expectedReceiver, type);
  if (!(type === "MSISDN" ? /^0\d{9}$/ : /^\d{13}$/).test(expected)) return false;
  if (!/^[\dxX*]+$/.test(actual) || actual.length !== expected.length) return false;
  // Each mask covers exactly one digit. Require enough visible digits to compare;
  // a partial match cannot establish the recipient's full account or identity.
  if (actual.replace(/\D/g, "").length < 4) return false;
  return [...actual].every((digit, index) => /[xX*]/.test(digit) || digit === expected[index]);
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
  // Recipient matching is informational: a bill may use different receiving
  // accounts. Provider verification and ledger checks decide acceptance.
  return {
    reference: raw.transRef.trim(),
    amount,
    transactedAt,
    receiverMatch: matchesReceiver(proxy?.account, proxy?.type, expectedReceiver),
  };
}
