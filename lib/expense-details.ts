import Decimal from "decimal.js";
import type { calculateSettlements } from "./settlements";

type Amount = { toString(): string };
export type ExpenseItem = {
  id: string; name: string; quantity: number; discountRate: string; total: string;
  shareAmount: string; baseAmount: string; serviceCharge: string; vat: string; roundingAdjustment: string;
  payerId: string; payerName: string; paidByYou: boolean;
  parts: number | null; totalParts: number | null; consumerCount: number;
};
export type ExpenseDetails = {
  shareTotal: string; paidUpfront: string; includesCharges: boolean; items: ExpenseItem[];
  baseSubtotal: string; serviceCharge: string; vat: string; roundingAdjustment: string;
  amountToPay: string; amountToReceive: string; remainingToPay: string; remainingToReceive: string; pairwise: boolean;
};
export type ExpenseRecipient = {
  recipientId: string; name: string; totalPayable: string; paidAmount?: string;
  beforeOffset?: string | null; offsetAmount?: string | null; offsetItems?: ExpenseItem[];
};
type ExpenseBill = {
  participants: { id: string; name: string; totalPayable: Amount }[];
  serviceCharge: Amount; vat: Amount; grandTotal: Amount;
  items: { id: string; name: string; price: Amount; quantity: number; discountRate: Amount;
    includeSc: boolean; includeVat: boolean; isShared: boolean; consumers: { id: string }[]; consumerQuantities: unknown }[];
};
type Calculation = NonNullable<ReturnType<typeof calculateSettlements>>;
const sum = (items: ExpenseItem[], key: "baseAmount" | "serviceCharge" | "vat" | "roundingAdjustment") =>
  items.reduce((total, item) => total.plus(item[key]), new Decimal(0)).toFixed(2);
export function expenseItems(bill: ExpenseBill, calculation: Calculation, participantId: string, onlyPayer?: string): ExpenseItem[] {
  return calculation.itemAllocations.flatMap(allocation => {
    const share = allocation.shares.find(s => s.participantId === participantId)!;
    if (onlyPayer && allocation.payerId !== onlyPayer) return [];
    const hasComponents = !share.baseAmount.isZero() || !share.serviceCharge.isZero() || !share.vat.isZero() || !share.roundingAdjustment.isZero();
    if (share.amount.isZero() && !hasComponents && (onlyPayer || allocation.payerId !== participantId)) return [];
    const item = bill.items.find(i => i.id === allocation.itemId)!;
    const quantities = item.consumerQuantities as Record<string, number> | null;
    const totalParts = quantities ? Object.values(quantities).reduce((a, b) => a + b, 0) : 0;
    return [{ id: item.id, name: item.name, quantity: item.quantity, discountRate: item.discountRate.toString(),
      total: allocation.total.toFixed(2), shareAmount: share.amount.toFixed(2), baseAmount: share.baseAmount.toFixed(2),
      serviceCharge: share.serviceCharge.toFixed(2), vat: share.vat.toFixed(2), roundingAdjustment: share.roundingAdjustment.toFixed(2),
      payerId: allocation.payerId, payerName: bill.participants.find(p => p.id === allocation.payerId)!.name,
      paidByYou: allocation.payerId === participantId, parts: totalParts ? quantities?.[participantId] ?? 0 : null,
      totalParts: totalParts || null, consumerCount: totalParts ? Object.values(quantities!).filter(q => q > 0).length : item.isShared ? bill.participants.length : item.consumers.length }];
  });
}
export function buildExpenseDetails(bill: ExpenseBill, participantId: string, calculation: Calculation | null): ExpenseDetails {
  if (calculation) {
    const person = calculation.participants.find(p => p.id === participantId)!;
    const items = expenseItems(bill, calculation, participantId);
    return { items, shareTotal: person.shareAmount.toFixed(2), paidUpfront: person.paidUpfront.toFixed(2),
      includesCharges: new Decimal(bill.serviceCharge.toString()).gt(0) || new Decimal(bill.vat.toString()).gt(0),
      baseSubtotal: sum(items, "baseAmount"), serviceCharge: sum(items, "serviceCharge"), vat: sum(items, "vat"),
      roundingAdjustment: sum(items, "roundingAdjustment"), amountToPay: person.amountToPay.toFixed(2), amountToReceive: person.amountToReceive.toFixed(2), remainingToPay: person.amountToPay.toFixed(2), remainingToReceive: person.amountToReceive.toFixed(2), pairwise: true };
  }
  // Legacy bills use their original subtotal-based fee formula and stored total.
  const rows = bill.items.map(item => {
    const net = new Decimal(item.price.toString()).mul(item.quantity).mul(new Decimal(1).minus(new Decimal(item.discountRate.toString()).div(100)));
    const quantities = item.consumerQuantities as Record<string, number> | null;
    const custom = quantities && Object.keys(quantities).length > 0;
    const consumers = item.isShared ? bill.participants.map(p => p.id) : item.consumers.map(p => p.id);
    const parts = custom ? Object.values(quantities).reduce((a, b) => a + b, 0) : consumers.length;
    const yours = custom ? quantities[participantId] ?? 0 : consumers.includes(participantId) ? 1 : 0;
    return { item, net, parts, custom, yours, shared: parts > 0 && yours > 0 ? net.mul(yours).div(parts) : new Decimal(0),
      assigned: parts > 0 };
  });
  const charge = (field: "includeSc" | "includeVat", amount: Amount) => {
    const eligible = rows.filter(r => r.assigned && r.item[field]);
    const denominator = eligible.reduce((n, r) => n.plus(r.net), new Decimal(0));
    return new Decimal(amount.toString()).mul(denominator.gt(0)
      ? eligible.reduce((n, r) => n.plus(r.shared), new Decimal(0)).div(denominator)
      : new Decimal(1).div(bill.participants.length || 1)).toDecimalPlaces(2);
  };
  const sc = charge("includeSc", bill.serviceCharge), vat = charge("includeVat", bill.vat);
  const items = rows.filter(r => r.yours > 0).map(({ item, net, parts, custom, yours, shared }): ExpenseItem => ({
    id: item.id, name: item.name, quantity: item.quantity, discountRate: item.discountRate.toString(), total: net.toFixed(2),
    shareAmount: shared.toFixed(2), baseAmount: shared.toFixed(2), serviceCharge: "0.00", vat: "0.00", roundingAdjustment: "0.00",
    payerId: "", payerName: "", paidByYou: false, parts: custom ? yours : null, totalParts: custom ? parts : null,
    consumerCount: custom ? Object.values(item.consumerQuantities as Record<string, number>).filter(q => q > 0).length : item.isShared ? bill.participants.length : item.consumers.length,
  }));
  const total = new Decimal(bill.participants.find(p => p.id === participantId)!.totalPayable.toString());
  const roundedBase = new Decimal(sum(items, "baseAmount"));
  return { items, shareTotal: total.toFixed(2), paidUpfront: "0.00", includesCharges: sc.gt(0) || vat.gt(0),
    baseSubtotal: roundedBase.toFixed(2), serviceCharge: sc.toFixed(2), vat: vat.toFixed(2),
    roundingAdjustment: total.minus(roundedBase).minus(sc).minus(vat).toFixed(2), amountToPay: total.toFixed(2), amountToReceive: "0.00", remainingToPay: total.toFixed(2), remainingToReceive: "0.00", pairwise: false };
}
