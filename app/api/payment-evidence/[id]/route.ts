import { prisma } from "@/lib/prisma";
import { requireParticipantAccess } from "@/lib/server/payment-access";
import { AccessError, accessErrorResponse } from "@/lib/server/authorization";
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
