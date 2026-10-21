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
  // Some verified domestic slips (including SCB) have no local-currency
  // conversion: local is { amount: 0, currency: "" }, with the baht amount
  // in amount.amount. Only accept that exact shape and reconcile it below.
  const domesticWithoutConversion = currency === "" && raw.amount?.local?.amount === 0;
  if (raw.countryCode !== "TH" || (currency !== "THB" && !domesticWithoutConversion))
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
  if (domesticWithoutConversion) {
    let domesticAmount: Decimal;
    try {
      domesticAmount = new Decimal(raw.amount?.amount);
    } catch {
      throw new PaymentError("ยอดเงินในสลิปไม่ถูกต้อง");
    }
    if (!domesticAmount.equals(amount))
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
  // Recipient matching is informational: a bill may use different receiving
  // accounts. Provider verification and ledger checks decide acceptance.
  return {
    reference: raw.transRef.trim(),
    amount,
    transactedAt,
    receiverMatch: Boolean(actual && expected && actual === expected),
  };
}
