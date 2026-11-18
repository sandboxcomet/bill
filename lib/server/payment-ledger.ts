import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PaymentError } from "@/lib/payment-contract";

export type PaymentTarget = {
  type: "participant" | "settlement" | "refund";
  id: string;
  version?: number;
};

// Development QR transfers are always 2 THB. Keep that real amount on the
// evidence, while completing the selected target's simulated balance only.
export function slipCreditAmount(amount: Prisma.Decimal, remaining: Prisma.Decimal) {
  return process.env.NODE_ENV === "development" && amount.eq(2)
    ? Prisma.Decimal.max(remaining, 0)
    : amount;
}

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
  if (target.type === "refund") {
    const reference = await tx.billRefund.findUniqueOrThrow({ where: { id: target.id } });
    await tx.$queryRaw`SELECT id FROM bills WHERE id = ${reference.billId} FOR UPDATE`;
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: reference.billId } });
    const refund = await tx.billRefund.findUniqueOrThrow({ where: { id: target.id } });
    if (!["PUBLISHED", "UNSHARED"].includes(bill.status) ||
        (target.version !== undefined && bill.version !== target.version) || refund.refundedAmount.gte(refund.amount))
      throw new PaymentError("รายการคืนเงินเปลี่ยนไป กรุณาเปิดใหม่", 409);
    return { version: bill.version, createdAt: refund.createdAt, remaining: refund.amount.minus(refund.refundedAmount) };
  }
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
  if (target.type === "refund") {
    const refund = await tx.billRefund.findUniqueOrThrow({ where: { id: target.id } });
    if (amount.lte(0) || amount.gt(refund.amount.minus(refund.refundedAmount)))
      throw new PaymentError("ยอดคืนเงินไม่ถูกต้อง", 409);
    await tx.billRefund.update({ where: { id: refund.id }, data: { refundedAmount: { increment: amount } } });
    if (refund.targetType === "settlement") {
      const old = await tx.billSettlement.findUniqueOrThrow({ where: { id: refund.targetId } });
      if (amount.gt(old.paidAmount)) throw new PaymentError("ยอดคืนเงินเกินยอดชำระ", 409);
      const paidAmount = old.paidAmount.minus(amount);
      await tx.billSettlement.update({ where: { id: old.id }, data: { paidAmount, isPaid: old.amount.gt(0) && paidAmount.gte(old.amount) } });
      await updateDebtor(tx, old.fromParticipantId);
    } else if (refund.targetType === "participant") {
      const old = await tx.participant.findUniqueOrThrow({ where: { id: refund.targetId } });
      if (amount.gt(old.paidAmount)) throw new PaymentError("ยอดคืนเงินเกินยอดชำระ", 409);
      const paidAmount = old.paidAmount.minus(amount);
      await tx.participant.update({ where: { id: old.id }, data: { paidAmount, isPaid: old.totalPayable.gt(0) && paidAmount.gte(old.totalPayable) } });
    } else throw new PaymentError("รายการคืนเงินไม่ถูกต้อง", 409);
  } else if (target.type === "settlement") {
    const settlement = await tx.billSettlement.findUniqueOrThrow({ where: { id: target.id } });
    const credited = slipCreditAmount(amount, settlement.amount.minus(settlement.paidAmount));
    const paidAmount = settlement.paidAmount.plus(credited);
    await tx.billSettlement.update({ where: { id: target.id }, data: { paidAmount, isPaid: paidAmount.gte(settlement.amount) } });
    await updateDebtor(tx, settlement.fromParticipantId);
  } else {
    const participant = await tx.participant.findUniqueOrThrow({
      where: { id: target.id },
    });
    const credited = slipCreditAmount(amount, participant.totalPayable.minus(participant.paidAmount));
    const paidAmount = participant.paidAmount.plus(credited);
    await tx.participant.update({
      where: { id: target.id },
      data: { paidAmount, isPaid: paidAmount.gte(participant.totalPayable) },
    });
  }
}
