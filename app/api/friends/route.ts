import { prisma } from "@/lib/prisma";
import { userPair } from "@/lib/social";
import { requireUserId, AccessError } from "@/lib/server/authorization";
import { requireQuota } from "@/lib/server/quota";
import { personFields, publicPerson, socialResponse } from "@/lib/server/social";
import { accountUserIds } from "@/lib/server/account-identity";

export async function GET() {
  return socialResponse(async () => {
    const userId = await requireUserId();
    const ids = await accountUserIds(userId);
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ lowUserId: { in: ids } }, { highUserId: { in: ids } }], status: { in: ["ACCEPTED", "PENDING"] } },
      include: { lowUser: { select: personFields }, highUser: { select: personFields } }, orderBy: { updatedAt: "desc" },
    });
    const friends = new Map<number, { id: string; status: string; source: string; incoming: boolean; person: ReturnType<typeof publicPerson> }>();
    for (const row of rows) {
      const person = publicPerson(ids.includes(row.lowUserId) ? row.highUser : row.lowUser);
      if (person.id === userId || friends.get(person.id)?.status === "ACCEPTED") continue;
      friends.set(person.id, { id: row.id, status: row.status, source: row.source,
        incoming: row.status === "PENDING" && !ids.includes(row.requesterId), person });
    }
    const aliases = await prisma.$queryRaw<{ targetId: number; name: string }[]>`
      SELECT target_id AS targetId, name FROM personal_aliases WHERE owner_id = ${userId} AND name IS NOT NULL`;
    const names = new Map(aliases.map(alias => [alias.targetId, alias.name]));
    return { friends: [...friends.values()].map(row => ({ ...row, person: { ...row.person, ownerAlias: names.get(row.person.id) ?? null } })) };
  });
}
export async function POST(req: Request) {
  return socialResponse(async () => {
    const userId = await requireUserId();
    await requireQuota(`friend-request:${userId}`, 30);
    const body = await req.json().catch(() => null);
    const targetId = body?.userId;
    if (!Number.isSafeInteger(targetId) || targetId <= 0 || targetId === userId) throw new AccessError("social.invalidMembers", 409);
    const friend = await prisma.user.findFirst({ where: { id: targetId, mergedIntoId: null, username: { not: null } }, select: { id: true } });
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
    const ids = await accountUserIds(userId);
    const body = await req.json().catch(() => null);
    if (typeof body?.id !== "string" || !["accept", "decline"].includes(body?.action)) throw new AccessError("social.invalidMembers", 409);
    const result = await prisma.friendship.updateMany({ where: {
      id: body.id, status: "PENDING", requesterId: { notIn: ids }, OR: [{ lowUserId: { in: ids } }, { highUserId: { in: ids } }],
    }, data: { status: body.action === "accept" ? "ACCEPTED" : "DECLINED" } });
    if (!result.count) throw new AccessError("social.requestUnavailable", 409);
    return { success: true };
  });
}
