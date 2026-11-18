import Decimal from "decimal.js";

// Reconcile each directed payment independently: money paid to one person
// cannot settle a debt owed to somebody else.
export type PaymentPair = {
  from: string;
  to: string;
  amount: Decimal.Value;
};

export type ReconciledPaymentPair = {
  from: string;
  to: string;
  owed: Decimal;
  paid: Decimal;
  refunded: Decimal;
  remaining: Decimal;
  refundDue: Decimal;
};

export function reconcileBillPayments(
  debts: PaymentPair[],
  payments: PaymentPair[],
  refunds: PaymentPair[],
): ReconciledPaymentPair[] {
  const pairs = new Map<string, ReconciledPaymentPair>();
  const add = (rows: PaymentPair[], field: "owed" | "paid" | "refunded") => {
    for (const row of rows) {
      const amount = new Decimal(row.amount);
      if (!row.from || !row.to || row.from === row.to || !amount.isFinite() ||
          amount.isNegative() || amount.decimalPlaces() > 2) {
        throw new Error("Invalid payment pair");
      }
      const key = JSON.stringify([row.from, row.to]);
      const pair = pairs.get(key) ?? {
        from: row.from, to: row.to, owed: new Decimal(0), paid: new Decimal(0),
        refunded: new Decimal(0), remaining: new Decimal(0), refundDue: new Decimal(0),
      };
      pair[field] = pair[field].plus(amount);
      pairs.set(key, pair);
    }
  };
  add(debts, "owed");
  add(payments, "paid");
  add(refunds, "refunded");
  return [...pairs.values()].map((pair) => {
    if (pair.refunded.gt(pair.paid)) throw new Error("Refund exceeds payment");
    const netPaid = pair.paid.minus(pair.refunded);
    return { ...pair, remaining: Decimal.max(pair.owed.minus(netPaid), 0),
      refundDue: Decimal.max(netPaid.minus(pair.owed), 0) };
  }).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}
