import { prisma } from "@/lib/prisma";
import { requireUserId, AccessError } from "@/lib/server/authorization";
import { requireQuota } from "@/lib/server/quota";
import { accountIds, autoFriend, personFields, publicPerson, socialResponse } from "@/lib/server/social";
import { accountUserIds } from "@/lib/server/account-identity";

export async function GET() {
  return socialResponse(async () => {
    const userId = await requireUserId();
    const ids = await accountUserIds(userId);
    const rows = await prisma.friendGroup.findMany({ where: { userId: { in: ids } }, orderBy: { createdAt: "desc" },
      include: { members: { include: { user: { select: personFields } }, orderBy: { id: "asc" } } } });
    return { groups: rows.map(row => ({ id: row.id, name: row.name,
      members: [...new Map(row.members.map(m => { const person = publicPerson(m.user); return [person.id, person]; })).values()] })) };
  });
}
export async function POST(req: Request) {
  return socialResponse(async () => {
    const userId = await requireUserId();
    await requireQuota(`friend-group:${userId}`, 30);
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80 || /\p{Cc}/u.test(name)) throw new AccessError("social.groupNameInvalid", 409);
    const ids = [...new Set([userId, ...accountIds(body?.memberIds)])];
    if (ids.length < 2 || ids.length > 100) throw new AccessError("social.invalidMembers", 409);
    const group = await prisma.$transaction(async tx => {
      const members = await tx.user.findMany({ where: { id: { in: ids }, mergedIntoId: null, username: { not: null } }, select: { id: true } });
      if (members.length !== ids.length) throw new AccessError("social.personNotFound", 404);
      const row = await tx.friendGroup.create({ data: { userId, name, members: { create: ids.map(id => ({ userId: id })) } } });
      await autoFriend(tx, userId, ids, "GROUP");
      return row;
    });
    return { success: true, id: group.id };
  });
}
