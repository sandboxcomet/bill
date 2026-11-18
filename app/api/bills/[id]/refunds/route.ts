import { prisma } from "@/lib/prisma";
import { AccessError, accessErrorResponse, requireUserId } from "@/lib/server/authorization";
import { ownsAccount } from "@/lib/server/account-identity";
import { requireParticipantAccess } from "@/lib/server/payment-access";
import { participantPromptPay, participantPromptPayFields } from "@/lib/server/participant-promptpay";
import { isValidPromptPayId, promptPayErrorKey } from "@/lib/promptpay";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    const bill = await prisma.bill.findUnique({ where: { id }, select: { userId: true } });
    if (!bill) throw new AccessError("Not found", 404);
    const owner = await ownsAccount(userId, bill.userId);
    const pid = new URL(request.url).searchParams.get("participantId");
    if (!owner) {
      if (!pid) throw new AccessError("Forbidden", 403);
      await requireParticipantAccess(request, id, pid);
    }
    const refunds = await prisma.billRefund.findMany({ where: { billId: id, ...(!owner ? { OR: [{ fromParticipantId: pid }, { toParticipantId: pid! }] } : {}) }, orderBy: { createdAt: "desc" } });
    const people = await prisma.participant.findMany({ where: { billId: id }, select: { id: true, name: true, accountUserId: true, ...participantPromptPayFields } });
    const evidence = refunds.length ? await prisma.paymentEvidence.findMany({ where: { targetType: "refund", targetId: { in: refunds.map(r => r.id) }, status: { not: "SUPERSEDED" } }, orderBy: { createdAt: "desc" }, select: { id: true, targetId: true, status: true, objectKey: true, amount: true } }) : [];
    const originalEvidence = refunds.length ? await prisma.paymentEvidence.findMany({ where: {
      OR: refunds.map(r => ({ targetType: r.targetType, targetId: r.targetId })), status: { in: ["VERIFIED", "REVERSED"] }, objectKey: { not: null },
    }, orderBy: { createdAt: "desc" }, select: { id: true, targetType: true, targetId: true, amount: true } }) : [];
    const result = await Promise.all(refunds.map(async refund => {
      const from = people.find(p => p.id === refund.fromParticipantId);
      const to = people.find(p => p.id === refund.toParticipantId);
      const canPay = refund.fromParticipantId === null ? owner : Boolean(from?.accountUserId && await ownsAccount(userId, from.accountUserId));
      const canReview = Boolean(to?.accountUserId && await ownsAccount(userId, to.accountUserId));
      const proof = evidence.find(e => e.targetId === refund.id);
      return { id: refund.id, amount: refund.amount.toString(), refundedAmount: refund.refundedAmount.toString(),
        fromName: from?.name ?? "เจ้าของบิล", toName: to?.name ?? "ผู้ร่วมบิล",
        fromParticipantId: refund.fromParticipantId, toParticipantId: refund.toParticipantId,
        promptPayId: canPay && to ? participantPromptPay(to) : null, canPay, canReview,
        ownerCanSetPromptPay: owner && !!to && !participantPromptPay(to) && refund.refundedAmount.lt(refund.amount) && !["UPLOADING", "PENDING_UPLOAD", "PENDING", "NEEDS_REVIEW"].includes(proof?.status ?? ""),
        evidenceStatus: proof?.status ?? null, evidenceAmount: proof?.amount.toString() ?? null,
        originalEvidence: owner || canReview ? originalEvidence.filter(e => e.targetType === refund.targetType && e.targetId === refund.targetId).map(e => ({ url: `/api/payment-evidence/${e.id}`, amount: e.amount.toString() })) : [],
        evidenceUrl: proof?.objectKey ? `/api/payment-evidence/${proof.id}` : null };
    }));
    return Response.json({ refunds: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return accessErrorResponse(error); }
}

// The bill owner can provide a missing bill-specific number for an open refund.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    const body = await request.json();
    if (typeof body.refundId !== "string" || typeof body.promptPayId !== "string" || !isValidPromptPayId(body.promptPayId))
      throw new AccessError(typeof body.promptPayId === "string" ? promptPayErrorKey(body.promptPayId) : "errors.promptPayFormat", 409);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM bills WHERE id = ${id} FOR UPDATE`;
      const bill = await tx.bill.findUnique({ where: { id }, select: { userId: true, status: true } });
      if (!bill || !await ownsAccount(userId, bill.userId, tx)) throw new AccessError("Not found", 404);
      const refund = await tx.billRefund.findFirst({ where: { id: body.refundId, billId: id } });
      if (!refund || refund.refundedAmount.gte(refund.amount) || bill.status !== "PUBLISHED") throw new AccessError("Not found", 404);
      const pending = await tx.paymentEvidence.count({ where: { targetType: "refund", targetId: refund.id, status: { in: ["UPLOADING", "PENDING_UPLOAD", "PENDING", "NEEDS_REVIEW"] } } });
      if (pending) throw new AccessError("กรุณารอให้ตรวจสอบสลิปคืนเงินที่ค้างอยู่เสร็จก่อน", 409);
      const recipient = await tx.participant.findUniqueOrThrow({ where: { id: refund.toParticipantId }, select: participantPromptPayFields });
      if (participantPromptPay(recipient)) throw new AccessError("มี PromptPay ของผู้รับแล้ว กรุณาโหลดหน้าใหม่", 409);
      await tx.participant.update({ where: { id: refund.toParticipantId }, data: { promptPayId: body.promptPayId } });
    });
    return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return accessErrorResponse(error); }
}
