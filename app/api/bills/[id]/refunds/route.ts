import { prisma } from "@/lib/prisma";
import { AccessError, accessErrorResponse, requireUserId } from "@/lib/server/authorization";
import { ownsAccount } from "@/lib/server/account-identity";
import { requireParticipantAccess } from "@/lib/server/payment-access";
import { participantPromptPay, participantPromptPayFields } from "@/lib/server/participant-promptpay";

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
        evidenceStatus: proof?.status ?? null, evidenceAmount: proof?.amount.toString() ?? null,
        originalEvidence: owner || canReview ? originalEvidence.filter(e => e.targetType === refund.targetType && e.targetId === refund.targetId).map(e => ({ url: `/api/payment-evidence/${e.id}`, amount: e.amount.toString() })) : [],
        evidenceUrl: proof?.objectKey ? `/api/payment-evidence/${proof.id}` : null };
    }));
    return Response.json({ refunds: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return accessErrorResponse(error); }
}
