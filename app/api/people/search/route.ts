import { prisma } from "@/lib/prisma";
import { normalizeUsername, isUsername } from "@/lib/social";
import { accountUserIds } from "@/lib/server/account-identity";
import { requireUserId, AccessError } from "@/lib/server/authorization";
import { requireQuota } from "@/lib/server/quota";
import { personFields, publicPerson, socialResponse } from "@/lib/server/social";

export async function POST(req: Request) {
  return socialResponse(async () => {
    const userId = await requireUserId();
    await requireQuota(`people-search:${userId}`, 30);
    const body = await req.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const email = query.includes("@") && !query.startsWith("@");
    if (query.length > 254 || (email ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query) : !isUsername(normalizeUsername(query))))
      throw new AccessError("social.searchInvalid", 409);
    const person = await prisma.user.findFirst({
      where: { id: { not: userId }, username: { not: null }, ...(email ? { email: query.toLowerCase() } : { username: normalizeUsername(query) }) },
      select: personFields,
    });
    if (!person) return { person: null };
    const resolved = publicPerson(person);
    if (resolved.id === userId || !resolved.username) return { person: null };
    const [ownIds, otherIds] = await Promise.all([accountUserIds(userId), accountUserIds(resolved.id)]);
    const relationships = await prisma.friendship.findMany({ where: { OR: [
      { lowUserId: { in: ownIds }, highUserId: { in: otherIds } },
      { highUserId: { in: ownIds }, lowUserId: { in: otherIds } },
    ], status: { in: ["ACCEPTED", "PENDING"] } } });
    const relationship = relationships.find(row => row.status === "ACCEPTED") ?? relationships[0];
    return { person: { ...resolved, relationship: relationship?.status === "ACCEPTED" ? "FRIEND"
      : relationship?.status === "PENDING" ? ownIds.includes(relationship.requesterId) ? "PENDING_SENT" : "PENDING_RECEIVED" : "NONE" } };
  });
}
