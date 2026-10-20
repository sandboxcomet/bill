import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParticipantAccess } from "@/lib/server/payment-access";
import {
  AccessError,
  accessErrorResponse,
  requireUserId,
} from "@/lib/server/authorization";
import {
  submitPaymentEvidence,
  latestEvidence,
  reviewPayment,
  paymentErrorResponse,
} from "@/lib/server/payments";

type Context = { params: Promise<{ id: string; pid: string }> };
const failure = (error: unknown) =>
  error instanceof AccessError
    ? accessErrorResponse(error)
    : paymentErrorResponse(error);
const target = (id: string) => ({ type: "participant" as const, id });
function evidenceUrl(evidenceId: string, _request: Request) {
  return `/api/payment-evidence/${evidenceId}`;
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id, pid } = await params;
    const { isOwner } = await requireParticipantAccess(request, id, pid);
    const bill = await prisma.bill.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        grandTotal: true,
        receiptSubtotal: true,
        totalDiscount: true,
        serviceCharge: true,
        vat: true,
        owner: { select: { name: true, promptPayId: true } },
        items: { include: { consumers: { select: { id: true, name: true } } } },
        participants: {
          where: { id: pid },
          select: {
            id: true,
            name: true,
            totalPayable: true,
            paidAmount: true,
            isPaid: true,
          },
        },
        _count: { select: { participants: true } },
      },
    });
    const evidence = await latestEvidence(target(pid));
    return NextResponse.json(
      {
        bill,
        participant: {
          ...bill.participants[0],
          payslipUrl: evidence ? evidenceUrl(evidence.id, request) : null,
          evidenceStatus: evidence?.status ?? null,
        },
        canManage: isOwner,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { id, pid } = await params;
    const { participant, isOwner } = await requireParticipantAccess(
      request,
      id,
      pid,
    );
    if (participant.bill.status !== "PUBLISHED")
      throw new AccessError("Bill is not published", 409);
    const data = await request.formData();
    const evidence = await submitPaymentEvidence(
      { ...target(pid), version: participant.bill.version },
      data.get("file"),
      participant.bill.owner.promptPayId,
      isOwner ? participant.bill.userId : null,
    );
    const updated = await prisma.participant.findUniqueOrThrow({
      where: { id: pid },
    });
    return NextResponse.json({
      success: true,
      url: evidenceUrl(evidence.id, request),
      isPaid: updated.isPaid,
      newPaidAmount: updated.paidAmount,
      verifiedAmount: evidence.amount,
      evidenceStatus: evidence.status,
      status: evidence.status === "NEEDS_REVIEW" ? "needs_review" : "verified",
    });
  } catch (error) {
    return failure(error);
  }
}

async function manage(
  request: NextRequest,
  context: Context,
  action: "CONFIRM" | "REVERSE",
) {
  try {
    const { id, pid } = await context.params;
    await requireParticipantAccess(request, id, pid, true);
    const body = await request.json();
    await reviewPayment(
      target(pid),
      await requireUserId(),
      action,
      body.reason,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  return manage(request, context, "CONFIRM");
}
export async function DELETE(request: NextRequest, context: Context) {
  return manage(request, context, "REVERSE");
}
