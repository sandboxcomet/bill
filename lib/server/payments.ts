import { requireQuota } from "./quota";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PaymentError, PendingSlip, verifySlipUpload } from "./slip-verification";
import { storeSlip } from "./payment-storage";

export type { PaymentTarget } from "./payment-ledger";
import { type PaymentTarget, serializable, lockTarget, updateDebtor, applyVerifiedAmount, slipCreditAmount } from "./payment-ledger";
import { recordPendingSlip } from "./pending-slips";
import { randomUUID } from "node:crypto";
import { allowLocalSlipReuse } from "./local-slip-testing";

export async function submitPaymentEvidence(
  target: PaymentTarget,
  file: FormDataEntryValue | null,
  receiver: string | null,
  actorId: number | null,
) {
  await requireQuota(`slip:${target.type}:${target.id}`, 12);
  let verified;
  try {
    verified = await verifySlipUpload(file, receiver);
  } catch (error) {
    if (error instanceof PendingSlip) return recordPendingSlip(target, error, receiver, actorId);
    throw error;
  }
  let referenceKey = { provider: "easyslip", reference: verified.reference };
  let evidence = await prisma.paymentEvidence.findUnique({
    where: { provider_reference: referenceKey },
  });
  const previousObjectKey = allowLocalSlipReuse() && evidence?.objectKey ? evidence.objectKey : null;
  if (allowLocalSlipReuse() && evidence && evidence.status !== "UPLOADING") {
    referenceKey = { provider: "easyslip", reference: `local-test:${randomUUID()}` };
    evidence = null;
  }
  if (!evidence) {
    try {
      evidence = await serializable(async (tx) => {
        await lockTarget(tx, target);
        if (target.type === "refund" && await tx.paymentEvidence.count({ where: {
          targetType: target.type, targetId: target.id, status: { in: ["UPLOADING", "PENDING_UPLOAD", "PENDING", "NEEDS_REVIEW"] },
        } })) throw new PaymentError("มีสลิปคืนเงินรอตรวจสอบอยู่แล้ว", 409);
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
  const recipientReview = evidence.status === "NEEDS_REVIEW" && evidence.reviewReason === "RECIPIENT_UNVERIFIED";
  if (evidence.status !== "UPLOADING" && !recipientReview) return evidence;
  const objectKey = previousObjectKey ?? await storeSlip(verified.image, evidence.id);
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
    if (current.status !== "UPLOADING" && !(current.status === "NEEDS_REVIEW" && current.reviewReason === "RECIPIENT_UNVERIFIED")) return current;
    const reviewReason = !allowLocalSlipReuse() && (!current.transactedAt || current.transactedAt < payable.createdAt)
        ? "DATE_REQUIRES_REVIEW"
        : (target.type === "refund" ? current.amount : slipCreditAmount(current.amount, payable.remaining)).gt(payable.remaining)
          ? "EXCEEDS_REMAINING"
          : target.type === "refund" ? "RECIPIENT_CONFIRMATION" : null;
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
      if (target.type === "refund") throw new PaymentError("ไม่สามารถย้อนการคืนเงินด้วยคำสั่งนี้", 409);
      const source = target.type === "settlement"
        ? await tx.billSettlement.findUniqueOrThrow({ where: { id: target.id }, select: { billId: true } })
        : await tx.participant.findUniqueOrThrow({ where: { id: target.id }, select: { billId: true } });
      if (await tx.billRevision.count({ where: { billId: source.billId } }))
        throw new PaymentError("ไม่สามารถย้อนรายการจ่ายหลังจากแก้ไขบิลแล้ว", 409);
      // Retain evidence and objects for audit; reversing is not deleting the slip.
      await tx.paymentEvidence.updateMany({
        where: {
          targetType: target.type,
          targetId: target.id,
          status: { in: ["VERIFIED", "NEEDS_REVIEW", "UPLOADING", "PENDING", "PENDING_UPLOAD"] },
        },
        data: { status: "REVERSED", confirmedBy: actorId },
      });
      if (target.type === "settlement") {
        const settlement = await tx.billSettlement.update({ where: { id: target.id }, data: { paidAmount: 0, isPaid: false } });
        await updateDebtor(tx, settlement.fromParticipantId);
      } else {
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

export async function paymentEvidence(target: PaymentTarget) {
  return prisma.paymentEvidence.findMany({
    where: {
      targetType: target.type,
      targetId: target.id,
      status: { in: ["VERIFIED", "NEEDS_REVIEW", "PENDING", "PENDING_UPLOAD", "REJECTED"] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, status: true, amount: true, objectKey: true, transactedAt: true },
  });
}

export async function rejectRefundEvidence(target: PaymentTarget, actorId: number, reason: string) {
  if (target.type !== "refund" || typeof reason !== "string" || reason.trim().length < 3 || reason.length > 500)
    throw new PaymentError("ระบุเหตุผลในการปฏิเสธสลิป", 400);
  return serializable(async tx => {
    await lockTarget(tx, target);
    const result = await tx.paymentEvidence.updateMany({ where: { targetType: "refund", targetId: target.id, status: "NEEDS_REVIEW" },
      data: { status: "REJECTED", reviewReason: "RECIPIENT_REJECTED", confirmedBy: actorId } });
    if (result.count !== 1) throw new PaymentError("ไม่มีสลิปรอการยืนยัน", 409);
    await tx.paymentAudit.create({ data: { targetType: "refund", targetId: target.id, actorId, action: "REJECT", reason: reason.trim() } });
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
