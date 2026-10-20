import { saveBill } from "@/lib/server/bill-write";
import { requireUserId, accessErrorResponse } from "@/lib/server/authorization";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/bills/[id] — load draft data
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id);
  const { id } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      items: {
        include: { consumers: { select: { id: true, name: true } } },
        orderBy: { id: "asc" },
      },
      participants: {
        where: { archived: false },
        select: {
          id: true,
          name: true,
          isPayer: true,
          paidAmount: true,
          isPaid: true,
        },
      },
    },
  });

  if (!bill || bill.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const evidenceCount = await prisma.paymentEvidence.count({
    where: {
      targetType: "participant",
      targetId: { in: bill.participants.map((p) => p.id) },
    },
  });
  return NextResponse.json(
    { bill: { ...bill, hasPaymentEvidence: evidenceCount > 0 } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const bill = await saveBill(id, userId, await req.json());
    return NextResponse.json({
      success: true,
      billId: id,
      version: bill.version,
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
