import { prisma } from "@/lib/prisma";
import { requireParticipantAccess } from "@/lib/server/payment-access";
import { AccessError, accessErrorResponse, requireUserId } from "@/lib/server/authorization";
import { ownsAccount } from "@/lib/server/account-identity";
import { readSlip } from "@/lib/server/payment-storage";
import { paymentErrorResponse } from "@/lib/server/payments";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const evidence = await prisma.paymentEvidence.findUnique({ where: { id } });
    if (!evidence?.objectKey) return new Response("Not found", { status: 404 });
    if (evidence.targetType === "participant") {
      const participant = await prisma.participant.findUnique({
        where: { id: evidence.targetId },
        select: { billId: true },
      });
      if (!participant) throw new AccessError("Not found", 404);
      await requireParticipantAccess(
        request,
        participant.billId,
        evidence.targetId,
      );
    } else if (evidence.targetType === "settlement") {
      const settlement = await prisma.billSettlement.findUnique({
        where: { id: evidence.targetId }, select: { billId: true, fromParticipantId: true },
      });
      if (!settlement) throw new AccessError("Not found", 404);
      await requireParticipantAccess(request, settlement.billId, settlement.fromParticipantId);
    } else if (evidence.targetType === "refund") {
      const refund = await prisma.billRefund.findUnique({ where: { id: evidence.targetId }, include: { bill: true } });
      if (!refund) throw new AccessError("Not found", 404);
      const userId = await requireUserId();
      if (!await ownsAccount(userId, refund.bill.userId)) {
        const ids = [refund.fromParticipantId, refund.toParticipantId].filter((id): id is string => Boolean(id));
        let allowed = false;
        for (const pid of ids) {
          try {
            const access = await requireParticipantAccess(request, refund.billId, pid);
            if (access.participant.accountUserId && await ownsAccount(userId, access.participant.accountUserId)) allowed = true;
          } catch { /* The token may belong to the other side of the refund. */ }
        }
        if (!allowed) throw new AccessError("Forbidden", 403);
      }
    } else throw new AccessError("Not found", 404);
    return new Response(await readSlip(evidence.objectKey), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return error instanceof AccessError
      ? accessErrorResponse(error)
      : paymentErrorResponse(error);
  }
}
