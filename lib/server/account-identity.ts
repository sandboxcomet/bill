import { prisma } from "@/lib/prisma";

// A merge retains the original rows. All aliases point directly at one active
// account, so historical bills, participants and payments never need rewriting.
export async function accountUserIds(userId: number, db: Pick<typeof prisma, "user"> = prisma) {
  const users = await db.user.findMany({
    where: { OR: [{ id: userId }, { mergedIntoId: userId }] }, select: { id: true },
  });
  return users.map(user => user.id);
}

export async function ownsAccount(userId: number | null, ownerId: number, db: Pick<typeof prisma, "user"> = prisma) {
  if (!userId) return false;
  if (userId === ownerId) return true;
  return Boolean(await db.user.findFirst({
    where: { id: ownerId, mergedIntoId: userId }, select: { id: true },
  }));
}

export const accountProfileFields = {
  id: true, username: true, name: true, nickname: true, image: true, promptPayId: true,
} as const;
export const resolvedProfileFields = {
  ...accountProfileFields, mergedInto: { select: accountProfileFields },
} as const;
const ownerFields = { name: true, nickname: true, promptPayId: true } as const;
export const resolvedOwnerFields = { ...ownerFields, mergedInto: { select: ownerFields } } as const;

export function primaryProfile<T extends { mergedInto?: object | null }>(user: T): Omit<T, "mergedInto"> {
  const { mergedInto, ...profile } = user;
  return (mergedInto ?? profile) as Omit<T, "mergedInto">;
}
