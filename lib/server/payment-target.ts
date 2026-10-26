import { prisma } from "@/lib/prisma";
import { AccessError } from "./authorization";
import type { PaymentTarget } from "./payments";
import { participantPromptPay, participantPromptPayFields } from "./participant-promptpay";

// A participant token covers only that debtor's transfers, never another person's.
export async function resolvePaymentTarget(
  bill: { id: string; itemPayersEnabled: boolean; version: number; owner: { promptPayId: string | null } },
  participantId: string,
  settlementId: unknown,
): Promise<{ target: PaymentTarget; receiver: string | null }> {
  if (!bill.itemPayersEnabled) {
    if (settlementId) throw new AccessError("Invalid payment target", 409);
    return { target: { type: "participant", id: participantId, version: bill.version }, receiver: bill.owner.promptPayId };
  }
  if (typeof settlementId !== "string" || !settlementId)
    throw new AccessError("เลือกผู้รับเงินก่อนโอน", 409);
  const settlement = await prisma.billSettlement.findFirst({
    where: { id: settlementId, billId: bill.id, fromParticipantId: participantId, archived: false },
    include: { toParticipant: { select: { ...participantPromptPayFields, archived: true } } },
  });
  if (!settlement || settlement.toParticipant.archived) throw new AccessError("Not found", 404);
  return { target: { type: "settlement", id: settlement.id, version: bill.version }, receiver: participantPromptPay(settlement.toParticipant) };
}
