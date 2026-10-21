import { prisma } from "@/lib/prisma";
import { normalizeUsername, isUsername, userPair } from "@/lib/social";
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
    const relationship = await prisma.friendship.findUnique({ where: { lowUserId_highUserId: userPair(userId, person.id) } });
    return { person: { ...publicPerson(person), relationship: relationship?.status === "ACCEPTED" ? "FRIEND"
      : relationship?.status === "PENDING" ? relationship.requesterId === userId ? "PENDING_SENT" : "PENDING_RECEIVED" : "NONE" } };
  });
}
