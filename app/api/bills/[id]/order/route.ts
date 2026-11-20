import { prisma } from "@/lib/prisma";
import { AccessError, accessErrorResponse, requireUserId } from "@/lib/server/authorization";
import { ownsAccount } from "@/lib/server/account-identity";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await request.json();
    if (!Array.isArray(body.items) || !Array.isArray(body.original) || body.items.some((item: unknown) => typeof item !== "string") || body.original.some((item: unknown) => typeof item !== "string")) throw new AccessError("Invalid order", 409);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM bills WHERE id = ${id} FOR UPDATE`;
      const bill = await tx.bill.findUnique({ where: { id }, select: { userId: true, items: { where: { archived: false }, select: { id: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
      if (!bill || !await ownsAccount(userId, bill.userId, tx)) throw new AccessError("Not found", 404);
      const current = bill.items.map(item => item.id);
      if (JSON.stringify(current) !== JSON.stringify(body.original) || body.items.length !== current.length || new Set(body.items).size !== current.length || body.items.some((item: string) => !current.includes(item))) throw new AccessError("order.conflict", 409);
      for (const [sortOrder, itemId] of body.items.entries()) await tx.billItem.update({ where: { id: itemId }, data: { sortOrder } });
    });
    return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return accessErrorResponse(error); }
}
