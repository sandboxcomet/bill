import { prisma } from "@/lib/prisma";
import { participantExpenses } from "@/lib/participant-expenses";
import { requireExpenseAccess } from "@/lib/server/payment-access";
import { AccessError, accessErrorResponse } from "@/lib/server/authorization";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const { id, pid } = await params;
    await requireExpenseAccess(request, id, pid);
    const bill = await prisma.bill.findUniqueOrThrow({ where: { id }, select: {
      itemPayersEnabled: true, serviceCharge: true, vat: true, grandTotal: true,
      participants: { where: { archived: false }, select: { id: true, name: true, totalPayable: true, paidAmount: true } },
      items: { include: { consumers: { select: { id: true } } }, orderBy: { id: "asc" } },
    } });
    if (!bill.participants.some(participant => participant.id === pid)) throw new AccessError("Not found", 404);
    const [outgoing, incoming] = bill.itemPayersEnabled ? await Promise.all([
      prisma.billSettlement.findMany({ where: { billId: id, fromParticipantId: pid, archived: false },
        include: { toParticipant: { select: { name: true } } }, orderBy: { id: "asc" } }),
      prisma.billSettlement.findMany({ where: { billId: id, toParticipantId: pid, archived: false }, select: { amount: true, paidAmount: true } }),
    ]) : [[], []];
    return Response.json(participantExpenses(bill, pid, outgoing, incoming), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return accessErrorResponse(error); }
}
