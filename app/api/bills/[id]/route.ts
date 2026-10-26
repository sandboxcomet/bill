import { saveBill } from "@/lib/server/bill-write";
import { requireUserId, accessErrorResponse } from "@/lib/server/authorization";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownsAccount, primaryProfile, resolvedProfileFields, participantDisplay } from "@/lib/server/account-identity";

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
      settlements: { select: { id: true } },
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
          accountUserId: true,
          accountUser: { select: resolvedProfileFields },
          promptPayId: true,
          paidAmount: true,
          isPaid: true,
        },
      },
    },
  });

  if (!bill || !await ownsAccount(userId, bill.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const evidenceCount = await prisma.paymentEvidence.count({
    where: {
      status: { notIn: ["REJECTED", "SUPERSEDED"] },
      OR: [
        { targetType: "participant", targetId: { in: bill.participants.map((p) => p.id) } },
        { targetType: "settlement", targetId: { in: bill.settlements.map((s) => s.id) } },
      ],
    },
  });
  return NextResponse.json(
    { bill: { ...bill, participants: bill.participants.map(person => {
      const p = participantDisplay(person);
      const account = person.accountUser ? primaryProfile(person.accountUser) : null;
      return { ...p, canonicalAccountUserId: account?.id, username: account?.username ?? undefined,
        hasPromptPay: Boolean(account?.promptPayId) };
    }), hasPaymentEvidence: evidenceCount > 0 } },
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
      status: bill.status,
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
