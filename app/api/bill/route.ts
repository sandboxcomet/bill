import { requireQuota } from "@/lib/server/quota";
import { PaymentError } from "@/lib/payment-contract";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createParticipantToken,
  billAccessRevision,
} from "@/lib/server/payment-access";

export async function POST() {
  return NextResponse.json(
    { error: "Create a draft and use /api/bills/:id with its version" },
    { status: 410 },
  );
}

// GET /api/bill?id=xxx — used by the share page to fetch data with passcode verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const passcode = req.headers.get("x-bill-passcode") ?? "";

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Prevent service workers and CDNs from caching this dynamic endpoint
  const headers = { "Cache-Control": "no-store, no-cache, must-revalidate" };

  try {
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, promptPayId: true } },
        participants: { where: { archived: false } },
        items: {
          include: { consumers: { select: { id: true, name: true } } },
        },
      },
    });

    if (!bill)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers },
      );

    const session = await auth();
    const isOwner = Number(session?.user?.id) === bill.userId;
    if (!isOwner && bill.status !== "PUBLISHED")
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers },
      );
    if (!isOwner && !bill.isPublic && passcode)
      await requireQuota(`bill-pin:${bill.id}`, 30);
    // Private bills without a configured passcode remain private.
    if (
      !isOwner &&
      !bill.isPublic &&
      (!bill.passcode || bill.passcode !== passcode)
    ) {
      return NextResponse.json(
        { error: "passcode_required", isPublic: false },
        { status: 403, headers },
      );
    }

    const { passcode: _passcode, ...safeBill } = bill;
    return NextResponse.json(
      {
        bill: {
          ...safeBill,
          participants: bill.participants.map((p) => ({
            id: p.id,
            name: p.name,
            totalPayable: p.totalPayable,
            isPaid: p.isPaid,
            isPayer: p.isPayer,
            paymentUrl: `/bill/${bill.id}/${p.id}`,
            paymentToken: createParticipantToken(
              bill.id,
              p.id,
              billAccessRevision(bill),
            ),
          })),
        },
      },
      { headers },
    );
  } catch (err: unknown) {
    if (err instanceof PaymentError)
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers },
      );
    console.error(
      "[api/bill GET]",
      err instanceof Error ? err.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "ไม่สามารถเปิดบิลได้ในขณะนี้" },
      { status: 500, headers },
    );
  }
}
