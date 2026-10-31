import Decimal from "decimal.js";

export const isPendingEvidence = (status: string | null | undefined) =>
  status === "PENDING" || status === "PENDING_UPLOAD";

export function recipientPaymentStatus(payment: { isPaid: boolean; totalPayable: string; paidAmount: string; evidenceStatus: string | null }) {
  const remaining = Decimal.max(new Decimal(payment.totalPayable).minus(payment.paidAmount), 0);
  if (payment.isPaid || remaining.isZero()) return "PAID";
  if (payment.evidenceStatus === "NEEDS_REVIEW") return "REVIEW";
  if (isPendingEvidence(payment.evidenceStatus)) return "BANK_PENDING";
  return new Decimal(payment.paidAmount).gt(0) ? "PARTIAL" : "UNPAID";
}
