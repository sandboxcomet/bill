import { requireQuota } from "@/lib/server/quota";
import { PaymentError } from "@/lib/payment-contract";
import { NextRequest, NextResponse } from "next/server";
import {
  optionalUserId,
  AccessError,
  accessErrorResponse,
} from "@/lib/server/authorization";
import { prisma } from "@/lib/prisma";
import { isPendingEvidence } from "@/lib/payment-status";
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
    const userId = await optionalUserId();
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, nickname: true, promptPayId: true } },
        participants: { where: { archived: false } },
        settlements: { where: { archived: false }, select: {
          id: true, fromParticipantId: true, toParticipantId: true,
          amount: true, paidAmount: true, isPaid: true,
        } },
        items: {
          include: { consumers: { select: { id: true, name: true } }, payer: { select: { id: true, name: true } } },
        },
      },
    });

    if (!bill)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers },
      );

    const isOwner = userId === bill.userId;
    if (!isOwner && bill.status !== "PUBLISHED")
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers },
      );
    // Rate-limit incorrect PIN guesses; authorized refreshes must not exhaust the quota.
    if (!isOwner && !bill.isPublic && passcode && bill.passcode !== passcode)
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

    // Only expose a status summary after bill access is authorized. Slip images,
    // references and provider details remain behind the payment access checks.
    const targets = bill.itemPayersEnabled
      ? bill.settlements.map((s) => ({ type: "settlement", id: s.id, participantId: s.fromParticipantId }))
      : bill.participants.map((p) => ({ type: "participant", id: p.id, participantId: p.id }));
    const evidence = targets.length ? await prisma.paymentEvidence.findMany({
      where: {
        OR: targets.map((target) => ({ targetType: target.type, targetId: target.id })),
        status: { not: "SUPERSEDED" },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { targetType: true, targetId: true, status: true },
    }) : [];
    const latestByTarget = new Map<string, string>();
    for (const row of evidence) {
      const key = `${row.targetType}:${row.targetId}`;
      if (!latestByTarget.has(key)) latestByTarget.set(key, row.status);
    }
    const slipStatuses = new Map<string, { needsReview: boolean; bankPending: boolean }>();
    for (const target of targets) {
      const status = latestByTarget.get(`${target.type}:${target.id}`);
      const summary = slipStatuses.get(target.participantId) ?? { needsReview: false, bankPending: false };
      summary.needsReview ||= status === "NEEDS_REVIEW";
      summary.bankPending ||= isPendingEvidence(status);
      slipStatuses.set(target.participantId, summary);
    }

    const { passcode: _passcode, ...safeBill } = bill;
    return NextResponse.json(
      {
        bill: {
          ...safeBill,
          owner: {
            ...bill.owner,
            name: bill.owner.nickname || bill.owner.name,
          },
          participants: bill.participants.map((p) => ({
            id: p.id,
            name: p.name,
            totalPayable: p.totalPayable,
            shareAmount: p.shareAmount,
            paidUpfront: p.paidUpfront,
            paidAmount: p.paidAmount,
            isPaid: p.isPaid,
            isPayer: p.isPayer,
            slipStatus: slipStatuses.get(p.id) ?? { needsReview: false, bankPending: false },
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
    if (err instanceof AccessError) return accessErrorResponse(err);
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
