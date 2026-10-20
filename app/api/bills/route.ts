import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/bills — list the current user's bills
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);

  const bills = await prisma.bill.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      grandTotal: true,
      status: true,
      version: true,
      isPublic: true,
      createdAt: true,
      _count: { select: { participants: true, items: true } },
    },
  });

  return NextResponse.json({ bills });
}
