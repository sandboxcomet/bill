import type { Prisma } from "@prisma/client";
import { userPair } from "@/lib/social";
import { AccessError } from "./authorization";
import { isPromptPayId } from "@/lib/settlements";
import { primaryProfile, resolvedProfileFields } from "./account-identity";

const providerFields = { accounts: { where: { provider: "google" }, select: { provider: true } } } as const;
export const personFields = { ...resolvedProfileFields, ...providerFields,
  mergedInto: { select: { ...resolvedProfileFields.mergedInto.select, ...providerFields } } } as const;
type PersonProfile = { id: number; username: string | null; name: string | null; nickname: string | null; image: string | null; promptPayId: string | null; accounts: { provider: string }[] };
export function publicPerson(input: PersonProfile & { mergedInto?: PersonProfile | null }) {
  const user = primaryProfile(input);
  return { id: user.id, username: user.username ?? "", name: user.nickname || user.name || user.username || "", image: user.image || (user.accounts.some(account => account.provider === "google") ? "/google-avatar.svg" : null),
    hasPromptPay: Boolean(user.promptPayId && isPromptPayId(user.promptPayId)) };
}
export async function autoFriend(tx: Prisma.TransactionClient, ownerId: number, memberIds: number[], source: "BILL" | "GROUP") {
  const users = await tx.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, mergedIntoId: true } });
  for (const friendId of [...new Set(users.map(user => user.mergedIntoId ?? user.id))].filter(id => id !== ownerId).sort((a, b) => a - b)) {
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
