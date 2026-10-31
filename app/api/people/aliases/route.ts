import { prisma } from "@/lib/prisma";
import { requireUserId, AccessError } from "@/lib/server/authorization";
import { personFields, publicPerson, socialResponse } from "@/lib/server/social";

export async function GET() {
  return socialResponse(async () => {
    const userId = await requireUserId();
    const rows = await prisma.$queryRaw<{ targetId: number; name: string }[]>`
      SELECT target_id AS targetId, name FROM personal_aliases WHERE owner_id = ${userId} AND name IS NOT NULL`;
    const targets = await prisma.user.findMany({ where: { id: { in: rows.map(row => row.targetId) } }, select: personFields });
    return { aliases: rows.flatMap(row => {
      const target = targets.find(user => user.id === row.targetId);
      return target ? [{ ...publicPerson(target), ownerAlias: row.name }] : [];
    }) };
  });
}

export async function PUT(req: Request) {
  return socialResponse(async () => {
    const userId = await requireUserId();
    const body = await req.json().catch(() => null);
    if (!Number.isSafeInteger(body?.targetId) || body.targetId <= 0 || typeof body?.name !== "string" || body.name.length > 191)
      throw new AccessError("Invalid participant alias", 409);
    const target = await prisma.user.findFirst({ where: { id: body.targetId, mergedIntoId: null, username: { not: null } }, select: { id: true } });
    if (!target) throw new AccessError("social.personNotFound", 404);
    const name = body.name.trim() || null;
    await prisma.$executeRaw`INSERT INTO personal_aliases (owner_id, target_id, name)
      VALUES (${userId}, ${target.id}, ${name}) ON DUPLICATE KEY UPDATE name = VALUES(name)`;
    return { success: true, name };
  });
}
