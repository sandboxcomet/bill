import { requireQuota } from "./quota";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PaymentError, verifySlipUpload } from "./slip-verification";
import { storeSlip } from "./payment-storage";

export type PaymentTarget = {
  type: "participant";
  id: string;
  version?: number;
};

async function serializable<T>(
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

async function lockTarget(tx: Prisma.TransactionClient, target: PaymentTarget) {
  if (target.type === "participant") {
    const participant = await tx.participant.findUniqueOrThrow({
      where: { id: target.id },
    });
    await tx.$queryRaw`SELECT id FROM bills WHERE id = ${participant.billId} FOR UPDATE`;
    const bill = await tx.bill.findUniqueOrThrow({
      where: { id: participant.billId },
    });
    if (
      bill.status !== "PUBLISHED" ||
      participant.archived ||
      (target.version !== undefined && bill.version !== target.version)
    )
      throw new PaymentError("Bill is no longer payable", 409);
    return {
      createdAt: bill.createdAt,
      remaining: participant.totalPayable.minus(participant.paidAmount),
    };
  }
  throw new PaymentError("Invalid payment target", 400);
}

async function applyVerifiedAmount(
  tx: Prisma.TransactionClient,
  target: PaymentTarget,
  amount: Prisma.Decimal,
) {
  if (target.type === "participant") {
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

export async function submitPaymentEvidence(
  target: PaymentTarget,
  file: FormDataEntryValue | null,
  receiver: string | null,
  actorId: number | null,
) {
  await requireQuota(`slip:${target.type}:${target.id}`, 12);
  const verified = await verifySlipUpload(file, receiver);
  const referenceKey = { provider: "easyslip", reference: verified.reference };
  let evidence = await prisma.paymentEvidence.findUnique({
    where: { provider_reference: referenceKey },
  });
  if (!evidence) {
    try {
      evidence = await serializable(async (tx) => {
        await lockTarget(tx, target);
        return tx.paymentEvidence.create({
          data: {
            targetVersion: target.version ?? 0,
            transactedAt: verified.transactedAt,
            ...referenceKey,
            targetType: target.type,
            targetId: target.id,
            amount: verified.amount.toFixed(2),
            receiverMatch: verified.receiverMatch,
            submittedBy: actorId,
            status: "UPLOADING",
          },
        });
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      evidence = await prisma.paymentEvidence.findUniqueOrThrow({
        where: { provider_reference: referenceKey },
      });
    }
  }
  if (evidence.targetType !== target.type || evidence.targetId !== target.id) {
    throw new PaymentError("สลิปนี้ถูกผูกกับรายการอื่นแล้ว", 409);
  }
  if (evidence.status === "REVERSED")
    throw new PaymentError("สลิปนี้ถูกย้อนรายการแล้ว กรุณาติดต่อเจ้าของ", 409);
  if (evidence.status !== "UPLOADING") return evidence;
  const objectKey = await storeSlip(verified.image, evidence.id);
  const evidenceId = evidence.id;
  return serializable(async (tx) => {
    await lockTarget(tx, target);
    const current = await tx.paymentEvidence.findUniqueOrThrow({
      where: { id: evidenceId },
    });
    const payable = await lockTarget(tx, {
      ...target,
      version: current.targetVersion,
    });
    if (current.status !== "UPLOADING") return current;
    const reviewReason = !current.receiverMatch
      ? "RECIPIENT_UNVERIFIED"
      : !current.transactedAt || current.transactedAt < payable.createdAt
        ? "DATE_REQUIRES_REVIEW"
        : current.amount.gt(payable.remaining)
          ? "EXCEEDS_REMAINING"
          : null;
    const status = reviewReason ? "NEEDS_REVIEW" : "VERIFIED";
    const updated = await tx.paymentEvidence.update({
      where: { id: current.id },
      data: { objectKey, status, reviewReason },
    });
    if (status === "VERIFIED")
      await applyVerifiedAmount(tx, target, current.amount);
    return updated;
  });
}

export async function reviewPayment(
  target: PaymentTarget,
  actorId: number,
  action: "CONFIRM" | "REVERSE",
  reason: string,
) {
  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 500
  ) {
    throw new PaymentError("ระบุเหตุผลในการยืนยันหรือย้อนรายการ", 400);
  }
  return serializable(async (tx) => {
    await lockTarget(tx, target);
    if (action === "CONFIRM") {
      const pending = await tx.paymentEvidence.findMany({
        where: {
          targetType: target.type,
          targetId: target.id,
          status: "NEEDS_REVIEW",
        },
      });
      if (pending.length === 0)
        throw new PaymentError("ไม่มีสลิปรอการยืนยัน", 409);
      for (const evidence of pending) {
        await tx.paymentEvidence.update({
          where: { id: evidence.id },
          data: { status: "VERIFIED", confirmedBy: actorId },
        });
        await applyVerifiedAmount(tx, target, evidence.amount);
      }
    } else {
      // Retain evidence and objects for audit; reversing is not deleting the slip.
      await tx.paymentEvidence.updateMany({
        where: {
          targetType: target.type,
          targetId: target.id,
          status: { in: ["VERIFIED", "NEEDS_REVIEW", "UPLOADING"] },
        },
        data: { status: "REVERSED", confirmedBy: actorId },
      });
      if (target.type === "participant") {
        await tx.participant.update({
          where: { id: target.id },
          data: { paidAmount: 0, isPaid: false },
        });
      }
    }
    await tx.paymentAudit.create({
      data: {
        targetType: target.type,
        targetId: target.id,
        actorId,
        action,
        reason: reason.trim(),
      },
    });
  });
}

export async function latestEvidence(target: PaymentTarget) {
  return prisma.paymentEvidence.findFirst({
    where: {
      targetType: target.type,
      targetId: target.id,
      status: { in: ["VERIFIED", "NEEDS_REVIEW"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, amount: true },
  });
}

export function paymentErrorResponse(error: unknown) {
  if (error instanceof PaymentError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "[payments] Operation failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" },
    { status: 500 },
  );
}
