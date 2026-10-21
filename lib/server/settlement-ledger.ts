import type { Prisma } from "@prisma/client";
import type { calculateSettlements } from "@/lib/settlements";

// Caller holds the bill lock and has verified there are no payments/evidence.
// Keep old pair rows for history; never delete or net one recipient into another.
export async function writeSettlementTransfers(
  tx: Prisma.TransactionClient,
  billId: string,
  settlement: ReturnType<typeof calculateSettlements>,
) {
  await tx.billSettlement.updateMany({
    where: { billId, archived: false }, data: { archived: true },
  });
  for (const transfer of settlement?.transfers ?? []) {
    const key = { billId, fromParticipantId: transfer.fromParticipantId,
      toParticipantId: transfer.toParticipantId };
    const data = { amount: transfer.amount.toFixed(2), paidAmount: "0.00",
      isPaid: false, archived: false };
    await tx.billSettlement.upsert({
      where: { billId_fromParticipantId_toParticipantId: key },
      create: { ...key, ...data }, update: data,
    });
  }
}
