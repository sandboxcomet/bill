import { Prisma } from "@prisma/client";
import type { calculateSettlements } from "@/lib/settlements";

// Caller holds the bill lock and has verified there are no payments/evidence.
// Keep old pair rows for history; never delete or net one recipient into another.
export async function writeSettlementTransfers(
  tx: Prisma.TransactionClient,
  billId: string,
  settlement: ReturnType<typeof calculateSettlements>,
  revision?: number,
) {
  const previous = await tx.billSettlement.findMany({ where: { billId } });
  await tx.billSettlement.updateMany({
    where: { billId, archived: false }, data: { archived: true },
  });
  for (const transfer of settlement?.transfers ?? []) {
    const key = { billId, fromParticipantId: transfer.fromParticipantId,
      toParticipantId: transfer.toParticipantId };
    const old = previous.find(p => p.fromParticipantId === key.fromParticipantId && p.toParticipantId === key.toParticipantId);
    const paid = old?.paidAmount ?? new Prisma.Decimal(0);
    const data = { amount: transfer.amount.toFixed(2), paidAmount: paid.toFixed(2),
      isPaid: paid.gte(transfer.amount.toFixed(2)), archived: false };
    await tx.billSettlement.upsert({
      where: { billId_fromParticipantId_toParticipantId: key },
      create: { ...key, ...data }, update: data,
    });
  }
  if (revision !== undefined) {
    for (const old of previous) {
      const updated = settlement?.transfers.find(t => t.fromParticipantId === old.fromParticipantId && t.toParticipantId === old.toParticipantId);
      const excess = old.paidAmount.minus(updated?.amount.toFixed(2) ?? "0.00");
      if (excess.gt(0)) await tx.billRefund.create({ data: {
        billId, version: revision, targetType: "settlement", targetId: old.id,
        fromParticipantId: old.toParticipantId, toParticipantId: old.fromParticipantId, amount: excess,
      } });
    }
  }
}
