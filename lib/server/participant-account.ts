import { accountUserIds } from "./account-identity";
import { serializable } from "./payment-ledger";
import { AccessError } from "./authorization";
import { hasCompleteProfile } from "@/lib/profile";
import { autoFriend } from "./social";

// A payer confirms one selected row. A typed name alone never identifies an
// account; keep the saved name, receiver snapshots and all ledger values intact.
export async function linkParticipantAccount(billId: string, participantId: string, userId: number, expectedVersion: number) {
  return serializable(async tx => {
    await tx.$queryRaw`SELECT id FROM bills WHERE id = ${billId} FOR UPDATE`;
    const bill = await tx.bill.findUnique({ where: { id: billId }, select: {
      status: true, version: true, owner: { select: { id: true, mergedIntoId: true } },
    } });
    const participant = await tx.participant.findFirst({ where: { id: participantId, billId, archived: false } });
    const user = await tx.user.findUnique({ where: { id: userId }, select: { username: true, nickname: true, mergedIntoId: true } });
    if (!user || user.mergedIntoId) throw new AccessError("Unauthorized", 401);
    if (!hasCompleteProfile(user)) throw new AccessError("account.profileRequired", 403);
    if (!participant || bill?.status !== "PUBLISHED") throw new AccessError("Not found", 404);
    if (bill.version !== expectedVersion) throw new AccessError("Open this payment from the bill share page", 409);
    const ids = await accountUserIds(userId, tx);
    if (participant.accountUserId) {
      if (ids.includes(participant.accountUserId)) return;
      throw new AccessError("payment.linkedToAnotherAccount", 409);
    }
    const existing = await tx.participant.findFirst({ where: {
      billId, archived: false, id: { not: participantId }, accountUserId: { in: ids },
    }, select: { id: true } });
    if (existing) throw new AccessError("payment.accountAlreadyInBill", 409);
    const linked = await tx.participant.updateMany({ where: {
      id: participantId, billId, archived: false, accountUserId: null,
    }, data: { accountUserId: userId } });
    if (!linked.count) throw new AccessError("payment.linkedToAnotherAccount", 409);
    await autoFriend(tx, bill.owner.mergedIntoId ?? bill.owner.id, [userId], "BILL");
    await tx.paymentAudit.create({ data: {
      targetType: "participant", targetId: participantId, actorId: userId,
      action: "LINK_ACCOUNT", reason: "Participant confirmed this payment as their own",
    } });
  });
}
