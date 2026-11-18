import { prisma } from "@/lib/prisma";
import { AccessError, accessErrorResponse, requireUserId } from "@/lib/server/authorization";
import { ownsAccount } from "@/lib/server/account-identity";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    const bill = await prisma.bill.findUnique({ where: { id }, select: { userId: true } });
    if (!bill || !await ownsAccount(userId, bill.userId)) throw new AccessError("Not found", 404);
    const revisions = await prisma.billRevision.findMany({ where: { billId: id }, orderBy: { version: "desc" } });
    return Response.json({ revisions: revisions.map(revision => {
      const snapshot = revision.snapshot as { name?: string; grandTotal?: string; serviceCharge?: string; vat?: string; items?: { name: string; price: string; quantity: number; discountRate: string }[]; participants?: { name: string; paidAmount: string }[] };
      return { version: revision.version, createdAt: revision.createdAt, grandTotal: snapshot.grandTotal ?? "0",
        name: snapshot.name, serviceCharge: snapshot.serviceCharge ?? "0", vat: snapshot.vat ?? "0",
        items: (snapshot.items ?? []).map(item => ({ name: item.name, price: item.price, quantity: item.quantity, discountRate: item.discountRate })),
        participants: (snapshot.participants ?? []).filter(person => Number(person.paidAmount) > 0).map(person => ({ name: person.name, paidAmount: person.paidAmount })) };
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return accessErrorResponse(error); }
}
