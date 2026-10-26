import Decimal from "decimal.js";
import { buildExpenseDetails, expenseItems } from "./expense-details";
import { calculateSettlements } from "./settlements";

type Amount = { toString(): string };
type ExpenseSource = Parameters<typeof buildExpenseDetails>[0];
type Bill = Omit<ExpenseSource, "participants" | "items"> & {
  itemPayersEnabled: boolean;
  participants: (ExpenseSource["participants"][number] & { paidAmount: Amount })[];
  items: (ExpenseSource["items"][number] & { payerId: string | null })[];
};
type Transfer = { id: string; toParticipantId: string; amount: Amount; paidAmount: Amount; isPaid: boolean; toParticipant: { name: string } };

// Shared expense explanations and the signed-in payment view use the same math.
// This projection contains no account identities, receiver numbers or evidence.
export function participantExpenses(bill: Bill, pid: string, outgoing: Transfer[], incoming: { amount: Amount; paidAmount: Amount }[]) {
  const participant = bill.participants.find(person => person.id === pid)!;
  const calculation = bill.itemPayersEnabled ? calculateSettlements({
    participants: bill.participants.map(person => ({ id: person.id, name: person.name, totalPayable: new Decimal(0) })),
    items: bill.items.map(item => ({ ...item, price: new Decimal(item.price.toString()),
      discountRate: new Decimal(item.discountRate.toString()), includeSC: item.includeSc,
      consumers: item.consumers.map(person => person.id), consumerQuantities: item.consumerQuantities as Record<string, number> | undefined,
    })), serviceCharge: new Decimal(bill.serviceCharge.toString()),
    vat: new Decimal(bill.vat.toString()), grandTotal: new Decimal(bill.grandTotal.toString()),
  }) : null;
  const expenseDetails = buildExpenseDetails(bill, pid, calculation);
  const unpaid = (rows: { amount: Amount; paidAmount: Amount }[]) => rows.reduce((sum, row) =>
    sum.plus(Decimal.max(new Decimal(row.amount.toString()).minus(Decimal.max(row.paidAmount.toString(), 0)), 0)), new Decimal(0));
  expenseDetails.remainingToPay = bill.itemPayersEnabled && outgoing.length ? unpaid(outgoing).toFixed(2)
    : Decimal.max(new Decimal(participant.totalPayable.toString()).minus(bill.itemPayersEnabled ? 0 : participant.paidAmount.toString()), 0).toFixed(2);
  expenseDetails.remainingToReceive = incoming.length ? unpaid(incoming).toFixed(2) : expenseDetails.amountToReceive;
  const settlements = outgoing.map(transfer => {
    const beforeOffset = calculation ? calculation.itemAllocations.filter(item => item.payerId === transfer.toParticipantId)
      .reduce((sum, item) => sum.plus(item.shares.find(share => share.participantId === pid)?.amount ?? 0), new Decimal(0)) : null;
    return { id: transfer.id, recipientId: transfer.toParticipantId, name: transfer.toParticipant.name,
      totalPayable: transfer.amount.toString(), paidAmount: transfer.paidAmount.toString(), isPaid: transfer.isPaid,
      beforeOffset: beforeOffset?.toString() ?? null,
      offsetItems: calculation ? expenseItems(bill, calculation, transfer.toParticipantId, pid) : [],
      offsetAmount: beforeOffset ? Decimal.max(beforeOffset.minus(transfer.amount.toString()), 0).toString() : null,
    };
  });
  return { expenseDetails, settlements };
}
