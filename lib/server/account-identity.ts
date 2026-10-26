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
const displayProfileFields = { name: true, nickname: true, username: true } as const;
export const participantDisplayFields = {
  ...displayProfileFields, mergedInto: { select: displayProfileFields },
} as const;

export function primaryProfile<T extends { mergedInto?: object | null }>(user: T): Omit<T, "mergedInto"> {
  const { mergedInto, ...profile } = user;
  return (mergedInto ?? profile) as Omit<T, "mergedInto">;
}

type DisplayProfile = { name: string | null; nickname: string | null; username: string | null };
// Keep the saved participant label for history, but display the linked primary
// account's current nickname. Never serialize the account relation itself.
export function participantDisplay<T extends { name: string; accountUser: (DisplayProfile & { mergedInto: DisplayProfile | null }) | null }>(participant: T) {
  const { accountUser, ...person } = participant;
  const account = accountUser ? primaryProfile(accountUser) : null;
  return { ...person, name: account?.nickname || account?.name || account?.username || person.name };
}
