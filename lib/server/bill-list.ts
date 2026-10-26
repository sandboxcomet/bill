import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { billProgress } from "@/lib/bill-progress";
import { isPendingEvidence } from "@/lib/payment-status";
import type { BillListItem, BillPaymentStatus } from "@/lib/bill-list";
import { accountUserIds } from "./account-identity";

const select = {
  id: true, name: true, userId: true, grandTotal: true, status: true, version: true, isPublic: true, createdAt: true, itemPayersEnabled: true,
  _count: { select: { participants: { where: { archived: false } }, items: true } },
  participants: { where: { archived: false }, select: { id: true, accountUserId: true, totalPayable: true, paidAmount: true } },
  settlements: { where: { archived: false }, select: { id: true, fromParticipantId: true, amount: true, paidAmount: true } },
} as const satisfies Prisma.BillSelect;
type Bill = Prisma.BillGetPayload<{ select: typeof select }>;
type Person = Bill["participants"][number];
const remaining = (amount: Decimal, paid: Decimal) => Decimal.max(amount.minus(Decimal.max(paid, 0)), 0);
function obligations(bill: Bill, people: Person[]) {
  const ids = new Set(people.map(person => person.id));
  return bill.itemPayersEnabled
    ? bill.settlements.filter(transfer => ids.has(transfer.fromParticipantId)).map(transfer => ({
      type: "settlement", id: transfer.id, amount: transfer.amount, paid: transfer.paidAmount,
    }))
    : people.map(person => ({ type: "participant", id: person.id, amount: person.totalPayable, paid: person.paidAmount }));
}
function summarize(bill: Bill, people: Person[], latest: Map<string, string>): BillListItem["payment"] {
  if (bill.status !== "PUBLISHED") return null;
  const targets = obligations(bill, people);
  const progress = billProgress({ itemPayersEnabled: bill.itemPayersEnabled,
    participants: people.map(person => ({ ...person, totalPayable: person.totalPayable.toString(), paidAmount: person.paidAmount.toString() })),
    settlements: bill.settlements.map(transfer => ({ ...transfer, amount: transfer.amount.toString(), paidAmount: transfer.paidAmount.toString() })),
  });
  const fullAmount = targets.reduce((sum, target) => sum.plus(Decimal.max(target.amount, 0)), new Decimal(0));
  const outstanding = targets.filter(target => remaining(target.amount, target.paid).gt(0));
  const status: BillPaymentStatus = fullAmount.isZero() && progress.remaining.isZero() ? "NO_PAYMENT"
    : progress.remaining.isZero() ? "PAID"
    : outstanding.some(target => latest.get(`${target.type}:${target.id}`) === "NEEDS_REVIEW") ? "REVIEW"
    : outstanding.some(target => isPendingEvidence(latest.get(`${target.type}:${target.id}`))) ? "BANK_PENDING"
    : fullAmount.gt(progress.remaining) ? "PARTIAL" : "UNPAID";
  return { status, remaining: progress.remaining.toFixed(2), settledCount: progress.paidCount, totalPeople: progress.totalPeople };
}
function row(bill: Bill, people: Person[], latest: Map<string, string>): BillListItem {
  return { id: bill.id, name: bill.name, status: bill.status, version: bill.version, isPublic: bill.isPublic, grandTotal: bill.grandTotal.toFixed(2), createdAt: bill.createdAt.toISOString(),
    _count: bill._count, payment: summarize(bill, people, latest) };
}
export async function listAccountBills(userId: number) {
  const ids = await accountUserIds(userId);
  const ownIds = new Set(ids);
  const bills = await prisma.bill.findMany({
    where: { OR: [{ userId: { in: ids } }, { status: "PUBLISHED", participants: { some: { archived: false, accountUserId: { in: ids } } } }] },
    orderBy: { createdAt: "desc" }, select,
  });
  const mine = (bill: Bill) => bill.participants.filter(person => person.accountUserId !== null && ownIds.has(person.accountUserId));
  const targets = bills.filter(bill => bill.status === "PUBLISHED").flatMap(bill =>
    obligations(bill, ownIds.has(bill.userId) ? bill.participants : mine(bill)).filter(target => remaining(target.amount, target.paid).gt(0)));
  const evidence = targets.length ? await prisma.paymentEvidence.findMany({
    where: { OR: targets.map(target => ({ targetType: target.type, targetId: target.id })), status: { not: "SUPERSEDED" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { targetType: true, targetId: true, status: true },
  }) : [];
  const latest = new Map<string, string>();
  for (const proof of evidence) {
    const key = `${proof.targetType}:${proof.targetId}`;
    if (!latest.has(key)) latest.set(key, proof.status);
  }
  return {
    bills: bills.filter(bill => ownIds.has(bill.userId)).map(bill => row(bill, bill.participants, latest)),
    payableBills: bills.filter(bill => bill.status === "PUBLISHED" && mine(bill).length).map(bill => row(bill, mine(bill), latest))
      .filter(bill => bill.payment && new Decimal(bill.payment.remaining).gt(0)),
  };
}
