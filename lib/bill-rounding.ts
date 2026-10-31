import Decimal from "decimal.js";

export type BillRounding = "none" | "up" | "down";

export function roundBillTotal(total: Decimal, mode: BillRounding): Decimal {
  if (mode === "up") return total.ceil();
  if (mode === "down") return total.floor();
  return total;
}
