import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PaymentError } from "@/lib/payment-contract";

export type PaymentTarget = {
  type: "participant" | "settlement";
  id: string;
  version?: number;
};

export async function serializable<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt >= 2 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034"
      )
        throw error;
    }
  }
}

export async function lockTarget(tx: Prisma.TransactionClient, target: PaymentTarget) {
  const reference = target.type === "settlement"
    ? await tx.billSettlement.findUniqueOrThrow({ where: { id: target.id }, select: { billId: true } })
    : await tx.participant.findUniqueOrThrow({ where: { id: target.id }, select: { billId: true } });
  await tx.$queryRaw`SELECT id FROM bills WHERE id = ${reference.billId} FOR UPDATE`;
  const bill = await tx.bill.findUniqueOrThrow({ where: { id: reference.billId } });
  const payable = target.type === "settlement"
    ? await tx.billSettlement.findUniqueOrThrow({ where: { id: target.id } })
    : await tx.participant.findUniqueOrThrow({ where: { id: target.id } });
  if (bill.status !== "PUBLISHED" || payable.archived ||
    bill.itemPayersEnabled !== (target.type === "settlement") ||
    (target.version !== undefined && bill.version !== target.version))
    throw new PaymentError("Bill is no longer payable", 409);
  const amount = "amount" in payable ? payable.amount : payable.totalPayable;
  if (amount.lte(0)) throw new PaymentError("ไม่มียอดที่ต้องโอน", 409);
  return { version: bill.version, createdAt: bill.createdAt, remaining: amount.minus(payable.paidAmount) };
}

export async function updateDebtor(tx: Prisma.TransactionClient, participantId: string) {
  const outgoing = await tx.billSettlement.findMany({ where: { fromParticipantId: participantId, archived: false } });
  const paidAmount = outgoing.reduce((sum, s) => sum.plus(s.paidAmount), new Prisma.Decimal(0));
  await tx.participant.update({ where: { id: participantId }, data: {
    paidAmount, isPaid: outgoing.length > 0 && outgoing.every((s) => s.isPaid),
  } });
}

export async function applyVerifiedAmount(
  tx: Prisma.TransactionClient,
  target: PaymentTarget,
  amount: Prisma.Decimal,
) {
  if (target.type === "settlement") {
    const settlement = await tx.billSettlement.findUniqueOrThrow({ where: { id: target.id } });
    const paidAmount = settlement.paidAmount.plus(amount);
    await tx.billSettlement.update({ where: { id: target.id }, data: { paidAmount, isPaid: paidAmount.gte(settlement.amount) } });
    await updateDebtor(tx, settlement.fromParticipantId);
  } else {
    const participant = await tx.participant.findUniqueOrThrow({
      where: { id: target.id },
    });
    const paidAmount = participant.paidAmount.plus(amount);
    await tx.participant.update({
      where: { id: target.id },
      data: { paidAmount, isPaid: paidAmount.gte(participant.totalPayable) },
    });
  }
}
