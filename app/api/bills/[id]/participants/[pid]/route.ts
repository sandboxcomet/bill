import { NextRequest, NextResponse } from "next/server";
import { isPendingEvidence } from "@/lib/payment-status";
import { participantExpenses } from "@/lib/participant-expenses";
import { prisma } from "@/lib/prisma";
import { requireParticipantAccess, requireParticipantViewAccess } from "@/lib/server/payment-access";
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

import { resolvePaymentTarget } from "@/lib/server/payment-target";
import { primaryProfile, resolvedOwnerFields } from "@/lib/server/account-identity";

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
    const { isOwner, participant: accessParticipant, readOnly } = await requireParticipantViewAccess(request, id, pid);
    const bill = await prisma.bill.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        grandTotal: true,
        itemPayersEnabled: true,
        receiptSubtotal: true,
        totalDiscount: true,
        serviceCharge: true,
        vat: true,
        owner: { select: resolvedOwnerFields },
        items: { include: { consumers: { select: { id: true, name: true } } }, orderBy: { id: "asc" } },
        participants: {
          where: { archived: false },
          select: {
            id: true,
            name: true,
            totalPayable: true,
            shareAmount: true,
            paidUpfront: true,
            paidAmount: true,
            isPaid: true,
          },
        },
        _count: { select: { participants: true } },
      },
    });
    const participant = bill.participants.find((p) => p.id === pid);
    if (!participant) throw new AccessError("Not found", 404);
    const outgoing = bill.itemPayersEnabled ? await prisma.billSettlement.findMany({
      where: { billId: id, fromParticipantId: pid, archived: false },
      include: { toParticipant: { select: { name: true, promptPayId: true } } },
      orderBy: { id: "asc" },
    }) : [];
    const incoming = bill.itemPayersEnabled ? await prisma.billSettlement.findMany({
      where: { billId: id, toParticipantId: pid, archived: false }, select: { amount: true, paidAmount: true },
    }) : [];
    const { expenseDetails, settlements: transfers } = participantExpenses(bill, pid, outgoing, incoming);
    const owner = primaryProfile(bill.owner);
    if (readOnly) return NextResponse.json({
      bill: { name: bill.name, itemPayersEnabled: bill.itemPayersEnabled,
        owner: { name: owner.nickname || owner.name, promptPayId: null } },
      participant: { ...participant, payslipUrl: null, evidenceStatus: null },
      settlements: transfers.map(transfer => ({ ...transfer, promptPayId: null, payslipUrl: null, evidenceStatus: null })),
      expenseDetails, canManage: false, requiresClaim: false, readOnly: true,
    }, { headers: { "Cache-Control": "private, no-store" } });
    const evidence = bill.itemPayersEnabled ? null : await latestEvidence(target(pid));
    const settlements = await Promise.all(transfers.map(async (transfer) => {
      const proof = await latestEvidence({ type: "settlement", id: transfer.id });
      return { ...transfer,
        promptPayId: outgoing.find(row => row.id === transfer.id)!.toParticipant.promptPayId,
        payslipUrl: proof?.objectKey ? evidenceUrl(proof.id, request) : null,
        evidenceStatus: proof?.status ?? null,
      };
    }));
    return NextResponse.json(
      {
        bill: {
          ...bill,
          participants: [participant],
          items: bill.items.filter(item => expenseDetails.items.some(i => i.id === item.id)),
          owner: {
            ...owner,
            name: owner.nickname || owner.name,
          },
        },
        participant: {
          ...participant,
          payslipUrl: evidence?.objectKey ? evidenceUrl(evidence.id, request) : null,
          evidenceStatus: evidence?.status ?? null,
        },
        settlements,
        expenseDetails,
        canManage: isOwner,
        requiresClaim: accessParticipant.accountUserId === null,
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
    const { participant, userId } = await requireParticipantAccess(
      request,
      id,
      pid,
    );
    if (participant.bill.status !== "PUBLISHED")
      throw new AccessError("Bill is not published", 409);
    const data = await request.formData();
    const payment = await resolvePaymentTarget(participant.bill, pid, data.get("settlementId"));
    const evidence = await submitPaymentEvidence(
      payment.target,
      data.get("file"),
      payment.receiver,
      userId,
    );
    const updated = await prisma.participant.findUniqueOrThrow({
      where: { id: pid },
    });
    const pending = isPendingEvidence(evidence.status);
    return NextResponse.json({
      success: true,
      url: evidence.objectKey ? evidenceUrl(evidence.id, request) : null,
      isPaid: updated.isPaid,
      newPaidAmount: updated.paidAmount,
      verifiedAmount: pending ? null : evidence.amount,
      evidenceStatus: evidence.status,
      status: pending ? "pending" : evidence.status === "NEEDS_REVIEW" ? "needs_review" : "verified",
    }, { status: pending ? 202 : 200 });
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
    const { participant } = await requireParticipantAccess(request, id, pid, true);
    const body = await request.json();
    const payment = await resolvePaymentTarget(participant.bill, pid, body.settlementId);
    await reviewPayment(
      payment.target,
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
