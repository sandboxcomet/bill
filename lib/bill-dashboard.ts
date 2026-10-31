import Decimal from "decimal.js";

type DashboardPerson = { id: string; accountUserId: number | null; totalPayable: Decimal; paidAmount: Decimal; shareAmount: Decimal; paidUpfront: Decimal };
type DashboardTransfer = { fromParticipantId: string; toParticipantId: string; amount: Decimal; paidAmount: Decimal };
type DashboardBill = { userId: number; status: string; itemPayersEnabled: boolean; participants: DashboardPerson[]; settlements: DashboardTransfer[] };

// Only confirmed payments reduce the outstanding amount. Drafts are excluded.
export function receivableSummary(bills: DashboardBill[], accountIds: number[]) {
  const accounts = new Set(accountIds);
  let total = new Decimal(0);
  let billCount = 0;
  for (const bill of bills) {
    if (bill.status !== "PUBLISHED") continue;
    const ownPeople = new Set(bill.participants.filter(person => person.accountUserId !== null && accounts.has(person.accountUserId)).map(person => person.id));
    const remaining = bill.itemPayersEnabled
      ? bill.settlements.filter(transfer => ownPeople.has(transfer.toParticipantId) && !ownPeople.has(transfer.fromParticipantId))
        .reduce((sum, transfer) => sum.plus(Decimal.max(transfer.amount.minus(Decimal.max(transfer.paidAmount, 0)), 0)), new Decimal(0))
      : accounts.has(bill.userId)
        ? bill.participants.filter(person => !ownPeople.has(person.id))
          .reduce((sum, person) => sum.plus(Decimal.max(person.totalPayable.minus(Decimal.max(person.paidAmount, 0)), 0)), new Decimal(0))
        : new Decimal(0);
    if (remaining.gt(0)) { total = total.plus(remaining); billCount++; }
  }
  return { amount: total.toFixed(2), billCount };
}

// Share is the user's allocation, including unpaid amounts. Cash out is the
// recorded amount advanced for items plus confirmed outgoing reimbursements.
export function spendingSummary(bills: DashboardBill[], accountIds: number[]) {
  const accounts = new Set(accountIds);
  let share = new Decimal(0);
  let paid = new Decimal(0);
  let shareBills = 0;
  let paidBills = 0;
  for (const bill of bills) {
    if (bill.status !== "PUBLISHED") continue;
    const people = bill.participants.filter(person => person.accountUserId !== null && accounts.has(person.accountUserId));
    if (!people.length) continue;
    const ownPeople = new Set(people.map(person => person.id));
    const billShare = people.reduce((sum, person) => sum.plus(bill.itemPayersEnabled ? person.shareAmount : person.totalPayable), new Decimal(0));
    const billPaid = bill.itemPayersEnabled
      ? people.reduce((sum, person) => sum.plus(person.paidUpfront), new Decimal(0)).plus(
        bill.settlements.filter(transfer => ownPeople.has(transfer.fromParticipantId) && !ownPeople.has(transfer.toParticipantId))
          .reduce((sum, transfer) => sum.plus(Decimal.min(Decimal.max(transfer.paidAmount, 0), Decimal.max(transfer.amount, 0))), new Decimal(0)))
      : accounts.has(bill.userId) ? new Decimal(0)
        : people.reduce((sum, person) => sum.plus(Decimal.min(Decimal.max(person.paidAmount, 0), Decimal.max(person.totalPayable, 0))), new Decimal(0));
    share = share.plus(billShare);
    paid = paid.plus(billPaid);
    if (billShare.gt(0)) shareBills++;
    if (billPaid.gt(0)) paidBills++;
  }
  return { share: share.toFixed(2), shareBills, paid: paid.toFixed(2), paidBills };
}
