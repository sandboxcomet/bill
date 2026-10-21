import { prisma } from "@/lib/prisma";
import { userPair } from "@/lib/social";
import { requireUserId, AccessError } from "@/lib/server/authorization";
import { requireQuota } from "@/lib/server/quota";
import { personFields, publicPerson, socialResponse } from "@/lib/server/social";

export async function GET() {
  return socialResponse(async () => {
    const userId = await requireUserId();
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ lowUserId: userId }, { highUserId: userId }], status: { in: ["ACCEPTED", "PENDING"] } },
      include: { lowUser: { select: personFields }, highUser: { select: personFields } }, orderBy: { updatedAt: "desc" },
    });
    return { friends: rows.map(row => ({ id: row.id, status: row.status, source: row.source,
      incoming: row.status === "PENDING" && row.requesterId !== userId,
      person: publicPerson(row.lowUserId === userId ? row.highUser : row.lowUser) })) };
  });
}
export async function POST(req: Request) {
  return socialResponse(async () => {
    const userId = await requireUserId();
    await requireQuota(`friend-request:${userId}`, 30);
    const body = await req.json().catch(() => null);
    const targetId = body?.userId;
    if (!Number.isSafeInteger(targetId) || targetId <= 0 || targetId === userId) throw new AccessError("social.invalidMembers", 409);
    const friend = await prisma.user.findFirst({ where: { id: targetId, username: { not: null } }, select: { id: true } });
    if (!friend) throw new AccessError("social.personNotFound", 404);
    const pair = userPair(userId, targetId);
    const row = await prisma.$transaction(async tx => {
      const current = await tx.friendship.upsert({ where: { lowUserId_highUserId: pair },
        create: { ...pair, requesterId: userId, status: "PENDING", source: "REQUEST" }, update: {} });
      if (current.status === "DECLINED") await tx.friendship.updateMany({ where: { id: current.id, status: "DECLINED" }, data: { status: "PENDING", requesterId: userId, source: "REQUEST" } });
      return current;
    });
    return { success: true, id: row.id };
  });
}
export async function PATCH(req: Request) {
  return socialResponse(async () => {
    const userId = await requireUserId();
    const body = await req.json().catch(() => null);
    if (typeof body?.id !== "string" || !["accept", "decline"].includes(body?.action)) throw new AccessError("social.invalidMembers", 409);
    const result = await prisma.friendship.updateMany({ where: {
      id: body.id, status: "PENDING", requesterId: { not: userId }, OR: [{ lowUserId: userId }, { highUserId: userId }],
    }, data: { status: body.action === "accept" ? "ACCEPTED" : "DECLINED" } });
    if (!result.count) throw new AccessError("social.requestUnavailable", 409);
    return { success: true };
  });
}
