import Decimal from "decimal.js";

type Amount = string | number;
type ProgressBill = {
  itemPayersEnabled: boolean;
  participants: { id: string; totalPayable: Amount; paidAmount: Amount }[];
  settlements: { fromParticipantId: string; amount: Amount; paidAmount: Amount }[];
};
export function billProgress(bill: ProgressBill) {
  let paidCount = 0;
  let noPaymentCount = 0;
  let remaining = new Decimal(0);
  for (const person of bill.participants) {
    const outgoing = bill.settlements.filter((s) => s.fromParticipantId === person.id);
    const due = bill.itemPayersEnabled && outgoing.length
      ? outgoing.reduce((sum, s) => sum.plus(Decimal.max(s.amount, 0)), new Decimal(0))
      : Decimal.max(person.totalPayable, 0);
    // Cap each transfer separately: overpaying one recipient cannot settle another.
    const outstanding = bill.itemPayersEnabled
      ? outgoing.length
        ? outgoing.reduce((sum, s) => sum.plus(Decimal.max(new Decimal(s.amount).minus(Decimal.max(s.paidAmount, 0)), 0)), new Decimal(0))
        : due
      : Decimal.max(due.minus(Decimal.max(person.paidAmount, 0)), 0);
    if (due.isZero()) noPaymentCount++;
    if (outstanding.isZero()) paidCount++;
    remaining = remaining.plus(outstanding);
  }
  const totalPeople = bill.participants.length;
  return {
    paidCount, totalPeople, noPaymentCount, remaining,
    percent: totalPeople ? Math.round(paidCount / totalPeople * 100) : 0,
    complete: totalPeople > 0 && paidCount === totalPeople && remaining.isZero(),
  };
}
