import { prisma } from "@/lib/prisma";
import { AccessError, accessErrorResponse, requireUserId } from "@/lib/server/authorization";
import { ownsAccount } from "@/lib/server/account-identity";
import { requireParticipantAccess } from "@/lib/server/payment-access";
import { participantPromptPay, participantPromptPayFields } from "@/lib/server/participant-promptpay";
import { paymentErrorResponse, submitPaymentEvidence, reviewPayment, rejectRefundEvidence } from "@/lib/server/payments";

type Context = { params: Promise<{ id: string; rid: string }> };
const failure = (error: unknown) => error instanceof AccessError ? accessErrorResponse(error) : paymentErrorResponse(error);

async function authorize(request: Request, billId: string, refundId: string, action: "pay" | "review") {
  const origin = new URL(process.env.AUTH_URL || request.url).origin;
  if (request.headers.get("origin") !== origin) throw new AccessError("Forbidden", 403);
  const userId = await requireUserId();
  const refund = await prisma.billRefund.findFirst({ where: { id: refundId, billId }, include: { bill: true } });
  if (!refund) throw new AccessError("Not found", 404);
  const subject = action === "pay" ? refund.fromParticipantId : refund.toParticipantId;
  if (subject === null) {
    if (!await ownsAccount(userId, refund.bill.userId)) throw new AccessError("Forbidden", 403);
  } else {
    const access = await requireParticipantAccess(request, billId, subject);
    if (!access.participant.accountUserId || !await ownsAccount(userId, access.participant.accountUserId))
      throw new AccessError("กรุณายืนยันบัญชีของผู้ร่วมบิลก่อนดำเนินการ", 403);
  }
  const recipient = await prisma.participant.findUniqueOrThrow({ where: { id: refund.toParticipantId }, select: participantPromptPayFields });
  const receiver = participantPromptPay(recipient);
  if (!receiver) throw new AccessError("ผู้รับคืนต้องตั้งค่า PromptPay ก่อน", 409);
  return { refund, userId, receiver };
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id, rid } = await params;
    const { refund, userId, receiver } = await authorize(request, id, rid, "pay");
    const evidence = await submitPaymentEvidence({ type: "refund", id: rid, version: refund.bill.version }, (await request.formData()).get("file"), receiver, userId);
    return Response.json({ status: evidence.status }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id, rid } = await params;
    const { refund, userId } = await authorize(request, id, rid, "review");
    const body = await request.json();
    const target = { type: "refund" as const, id: rid, version: refund.bill.version };
    if (body.action === "reject") await rejectRefundEvidence(target, userId, body.reason);
    else if (body.action === "confirm") await reviewPayment(target, userId, "CONFIRM", body.reason);
    else throw new AccessError("Invalid action", 409);
    return Response.json({ success: true });
  } catch (error) { return failure(error); }
}
