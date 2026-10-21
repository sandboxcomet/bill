import type { Prisma } from "@prisma/client";
import { userPair } from "@/lib/social";
import { AccessError } from "./authorization";
import { isPromptPayId } from "@/lib/settlements";

export const personFields = { id: true, username: true, name: true, nickname: true, image: true, promptPayId: true } as const;
export function publicPerson(user: { id: number; username: string | null; name: string | null; nickname: string | null; image: string | null; promptPayId: string | null }) {
  return { id: user.id, username: user.username!, name: user.nickname || user.name || user.username!, image: user.image,
    hasPromptPay: Boolean(user.promptPayId && isPromptPayId(user.promptPayId)) };
}
export async function autoFriend(tx: Prisma.TransactionClient, ownerId: number, memberIds: number[], source: "BILL" | "GROUP") {
  for (const friendId of [...new Set(memberIds)].filter(id => id !== ownerId).sort((a, b) => a - b)) {
    const pair = userPair(ownerId, friendId);
    await tx.friendship.upsert({ where: { lowUserId_highUserId: pair },
      create: { ...pair, requesterId: ownerId, status: "ACCEPTED", source },
      update: { status: "ACCEPTED", source } });
  }
}
export function accountIds(value: unknown): number[] {
  if (!Array.isArray(value) || !value.length || value.length > 99 || value.some(id => !Number.isSafeInteger(id) || id <= 0))
    throw new AccessError("social.invalidMembers", 409);
  return [...new Set(value as number[])];
}

export async function socialResponse(work: () => Promise<unknown>) {
  try { return Response.json(await work(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    const { PaymentError } = await import("@/lib/payment-contract");
    const { accessErrorResponse } = await import("./authorization");
    if (error instanceof PaymentError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    return accessErrorResponse(error);
  }
}
