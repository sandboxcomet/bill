import { NextRequest, NextResponse } from "next/server";
import Decimal from "decimal.js";
import { isPendingEvidence } from "@/lib/payment-status";
import { buildExpenseDetails, expenseItems } from "@/lib/expense-details";
import { calculateSettlements } from "@/lib/settlements";
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
    const { isOwner } = await requireParticipantAccess(request, id, pid);
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
    const calculation = bill.itemPayersEnabled ? calculateSettlements({
      participants: bill.participants.map((p) => ({ id: p.id, name: p.name, totalPayable: new Decimal(0) })),
      items: bill.items.map((i) => ({ ...i, price: new Decimal(i.price.toString()),
        discountRate: new Decimal(i.discountRate.toString()), includeSC: i.includeSc,
        consumers: i.consumers.map((p) => p.id),
        consumerQuantities: i.consumerQuantities as Record<string, number> | undefined,
      })),
      serviceCharge: new Decimal(bill.serviceCharge.toString()),
      vat: new Decimal(bill.vat.toString()), grandTotal: new Decimal(bill.grandTotal.toString()),
    }) : null;
    const expenseDetails = buildExpenseDetails(bill, pid, calculation);
    const evidence = bill.itemPayersEnabled ? null : await latestEvidence(target(pid));
    const outgoing = bill.itemPayersEnabled ? await prisma.billSettlement.findMany({
      where: { billId: id, fromParticipantId: pid, archived: false },
      include: { toParticipant: { select: { name: true, promptPayId: true } } },
      orderBy: { id: "asc" },
    }) : [];
    const incoming = bill.itemPayersEnabled ? await prisma.billSettlement.findMany({
      where: { billId: id, toParticipantId: pid, archived: false }, select: { amount: true, paidAmount: true },
    }) : [];
    const unpaid = (rows: { amount: { toString(): string }; paidAmount: { toString(): string } }[]) => rows.reduce((sum, s) =>
      sum.plus(Decimal.max(new Decimal(s.amount.toString()).minus(Decimal.max(s.paidAmount.toString(), 0)), 0)), new Decimal(0));
    expenseDetails.remainingToPay = bill.itemPayersEnabled && outgoing.length ? unpaid(outgoing).toFixed(2)
      : Decimal.max(new Decimal(participant.totalPayable.toString()).minus(bill.itemPayersEnabled ? 0 : participant.paidAmount.toString()), 0).toFixed(2);
    expenseDetails.remainingToReceive = incoming.length ? unpaid(incoming).toFixed(2) : expenseDetails.amountToReceive;
    const settlements = await Promise.all(outgoing.map(async (s) => {
      const proof = await latestEvidence({ type: "settlement", id: s.id });
      const beforeOffset = calculation ? calculation.itemAllocations
        .filter((i) => i.payerId === s.toParticipantId)
        .reduce((sum, i) => sum.plus(i.shares.find((share) => share.participantId === pid)?.amount ?? 0), new Decimal(0)) : null;
      return {
        beforeOffset,
        offsetItems: calculation ? expenseItems(bill, calculation, s.toParticipantId, pid) : [],
        offsetAmount: beforeOffset ? Decimal.max(beforeOffset.minus(s.amount.toString()), 0) : null,
        id: s.id, recipientId: s.toParticipantId, name: s.toParticipant.name, promptPayId: s.toParticipant.promptPayId,
        totalPayable: s.amount, paidAmount: s.paidAmount, isPaid: s.isPaid,
        payslipUrl: proof?.objectKey ? evidenceUrl(proof.id, request) : null,
        evidenceStatus: proof?.status ?? null,
      };
    }));
    const owner = primaryProfile(bill.owner);
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
    const payment = await resolvePaymentTarget(participant.bill, pid, data.get("settlementId"));
    const evidence = await submitPaymentEvidence(
      payment.target,
      data.get("file"),
      payment.receiver,
      isOwner ? participant.bill.userId : null,
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
