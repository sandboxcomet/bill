import Decimal from "decimal.js";
import { calculateSettlements } from "./settlements";

export type BillPerson = { id: string; name: string; totalPayable: string; paidAmount: string };
export type BillTransfer = { fromParticipantId: string; toParticipantId: string; amount: string; paidAmount: string };
export function personBalance(person: BillPerson, settlements: BillTransfer[], itemPayersEnabled: boolean) {
  const outgoing = settlements.filter(s => s.fromParticipantId === person.id);
  const incoming = settlements.filter(s => s.toParticipantId === person.id);
  const remaining = (rows: BillTransfer[]) => rows.reduce((sum, s) =>
    sum.plus(Decimal.max(new Decimal(s.amount).minus(Decimal.max(s.paidAmount, 0)), 0)), new Decimal(0));
  return {
    due: itemPayersEnabled ? (outgoing.length ? remaining(outgoing) : Decimal.max(person.totalPayable, 0))
      : Decimal.max(new Decimal(person.totalPayable).minus(Decimal.max(person.paidAmount, 0)), 0),
    receive: itemPayersEnabled ? remaining(incoming) : new Decimal(0),
  };
}
export type ViewItem = {
  id: string; name: string; price: string; quantity: number; discountRate: string;
  isShared: boolean; includeSc?: boolean; includeVat?: boolean;
  payer: { id: string; name: string } | null;
  consumers: { id: string; name: string }[];
  consumerQuantities: Record<string, number> | null;
};
export function ownItems(bill: {
  items: ViewItem[]; participants: BillPerson[]; itemPayersEnabled: boolean;
  serviceCharge: string; vat: string; grandTotal: string;
}, participantId: string) {
  const calculation = bill.itemPayersEnabled ? calculateSettlements({
    items: bill.items.map(i => ({ ...i, price: new Decimal(i.price), discountRate: new Decimal(i.discountRate),
      includeSC: i.includeSc, payerId: i.payer?.id, consumers: i.consumers.map(p => p.id),
      consumerQuantities: i.consumerQuantities ?? undefined })),
    participants: bill.participants.map(p => ({ ...p, totalPayable: new Decimal(p.totalPayable) })),
    serviceCharge: new Decimal(bill.serviceCharge), vat: new Decimal(bill.vat), grandTotal: new Decimal(bill.grandTotal),
  }) : null;
  return bill.items.flatMap<{ item: ViewItem; share: Decimal | null }>(item => {
    const allocation = calculation?.itemAllocations.find(a => a.itemId === item.id);
    const share = allocation?.shares.find(s => s.participantId === participantId)?.amount;
    if (share) return share.gt(0) ? [{ item, share }] : [];
    const custom = item.consumerQuantities && Object.values(item.consumerQuantities).some(n => n > 0);
    const participates = custom ? (item.consumerQuantities![participantId] ?? 0) > 0
      : item.isShared || item.consumers.some(p => p.id === participantId);
    return participates ? [{ item, share: null }] : [];
  });
}
