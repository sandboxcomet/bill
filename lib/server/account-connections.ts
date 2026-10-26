import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma, type AccountConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSessionIdentity } from "./auth-session";

export const connectionCookie = "wonglao-bill.account-connection";
const lifetime = 10 * 60 * 1000;
const recentLogin = 15 * 60 * 1000;
export type LoginProvider = "google" | "line";
export const isLoginProvider = (value: unknown): value is LoginProvider => value === "google" || value === "line";
export class ConnectionError extends Error {
  constructor(message: string, public readonly status = 409) { super(message); }
}
const expired = () => new ConnectionError("connections.expired");
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
type Database = Prisma.TransactionClient;

export async function activeConnection(userId: number) {
  const token = (await cookies()).get(connectionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const attempt = await prisma.accountConnection.findUnique({ where: { id: tokenHash(token) } });
  return attempt?.initiatorId === userId && attempt.expiresAt.getTime() > Date.now() &&
    ["STARTED", "VERIFIED"].includes(attempt.status) ? attempt : null;
}

export async function startConnection(userId: number, provider: LoginProvider) {
  const store = await cookies();
  const identity = await readSessionIdentity(store);
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { accounts: true } });
  if (!identity || !user || user.mergedIntoId || identity.id !== userId || identity.version !== user.authVersion) throw expired();
  if (!identity.authenticatedAt || Date.now() - identity.authenticatedAt > recentLogin) {
    throw new ConnectionError("connections.reauthenticate");
  }
  if (user.accounts.some(account => account.provider === provider)) throw new ConnectionError("connections.alreadyLinked");
  const token = randomBytes(32).toString("hex");
  await prisma.accountConnection.create({ data: {
    id: tokenHash(token), initiatorId: userId, initiatorVersion: user.authVersion,
    provider, expiresAt: new Date(Date.now() + lifetime),
  } });
  store.set(connectionCookie, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
    path: "/", maxAge: lifetime / 1000,
  });
}

// Called only by Auth.js after it validates the provider's OAuth response. Return
// a redirect BEFORE its adapter can create a second user or link an identity.
export async function captureConnection(
  account: { provider: string; providerAccountId: string } | null,
  profile: { name?: string | null },
): Promise<string | true> {
  if (!account || !isLoginProvider(account.provider)) return true;
  const store = await cookies();
  const identity = await readSessionIdentity(store);
  const token = store.get(connectionCookie)?.value;
  const attempt = token && /^[a-f0-9]{64}$/.test(token)
    ? await prisma.accountConnection.findUnique({ where: { id: tokenHash(token) } }) : null;
  const owner = await prisma.account.findUnique({ where: { provider_providerAccountId: {
    provider: account.provider, providerAccountId: account.providerAccountId,
  } }, include: { user: true } });
  const user = identity ? await prisma.user.findUnique({ where: { id: identity.id } }) : null;
  const signedIn = Boolean(identity && user && !user.mergedIntoId && identity.version === user.authVersion);
  if (attempt && ["STARTED", "VERIFIED"].includes(attempt.status)) {
    if (!signedIn) {
      // A revoked/expired session must not leave a browser trapped in a linking
      // redirect loop. Retain the attempt as cancelled and ask for normal login.
      await prisma.accountConnection.updateMany({ where: { id: attempt.id, status: { in: ["STARTED", "VERIFIED"] } },
        data: { status: "CANCELLED", completedAt: new Date() } });
      return "/login?error=OAuthAccountNotLinked";
    }
    if (!signedIn || !identity || !user || attempt.status !== "STARTED" ||
        attempt.initiatorId !== identity.id || attempt.initiatorVersion !== identity.version ||
        attempt.provider !== account.provider || attempt.expiresAt.getTime() <= Date.now() ||
        Date.now() - identity.authenticatedAt > recentLogin || owner?.user.mergedIntoId) {
      return "/settings?connectionError=expired#connections";
    }
    if (owner?.userId === user.id) return "/settings?connectionError=alreadyLinked#connections";
    const changed = await prisma.accountConnection.updateMany({ where: {
      id: attempt.id, status: "STARTED", expiresAt: { gt: new Date() },
    }, data: {
      status: "VERIFIED", providerAccountId: account.providerAccountId,
      targetUserId: owner?.userId ?? null, targetVersion: owner?.user.authVersion ?? null,
      profileName: profile.name?.slice(0, 191) ?? null,
    } });
    return changed.count ? "/settings?connection=review#connections" : "/settings?connectionError=expired#connections";
  }
  // Linking is an explicit, reviewed action even if Auth.js could auto-link an
  // unowned provider while signed in. Ordinary login to a linked identity works.
  if (signedIn && owner?.userId !== user!.id) return "/settings?connectionError=start#connections";
  return true;
}

async function accountSummary(db: Database, id: number) {
  const user = await db.user.findUnique({ where: { id }, include: { accounts: { select: { provider: true, providerAccountId: true } } } });
  if (!user || user.mergedIntoId) throw expired();
  const aliases = await db.user.findMany({ where: { OR: [{ id }, { mergedIntoId: id }] }, select: { id: true } });
  const ids = aliases.map(alias => alias.id);
  const [bills, groups, friends] = await Promise.all([
    db.bill.count({ where: { userId: { in: ids } } }),
    db.friendGroup.count({ where: { userId: { in: ids } } }),
    db.friendship.count({ where: { OR: [{ lowUserId: { in: ids } }, { highUserId: { in: ids } }], status: "ACCEPTED" } }),
  ]);
  return { id: user.id, name: user.nickname || user.name || user.username || "", username: user.username,
    promptPayId: user.promptPayId, providers: [...new Set(user.accounts.map(account => account.provider))],
    bills, groups, friends, updatedAt: user.updatedAt.toISOString(), authVersion: user.authVersion,
    identities: user.accounts.map(account => `${account.provider}:${account.providerAccountId}`).sort(),
  };
}

async function connectionReview(db: Database, attempt: AccountConnection) {
  if (attempt.status !== "VERIFIED" || !attempt.providerAccountId || attempt.expiresAt.getTime() <= Date.now()) throw expired();
  const current = await accountSummary(db, attempt.initiatorId);
  const other = attempt.targetUserId ? await accountSummary(db, attempt.targetUserId) : null;
  if (current.authVersion !== attempt.initiatorVersion || (other && other.authVersion !== attempt.targetVersion)) throw expired();
  if (current.providers.includes(attempt.provider) || other?.providers.some(provider => current.providers.includes(provider))) {
    throw new ConnectionError("connections.providerConflict");
  }
  const revision = createHmac("sha256", process.env.AUTH_SECRET!).update(JSON.stringify([
    attempt.id, current.id, current.updatedAt, current.identities,
    other?.id, other?.updatedAt, other?.identities,
  ])).digest("hex");
  // Provider subject IDs are only for server validation, never sent to clients.
  const safe = ({ identities: _, authVersion: __, updatedAt: ___, ...summary }: typeof current) => summary;
  return { current: safe(current), other: other ? safe(other) : null,
    provider: attempt.provider, profileName: attempt.profileName, revision, expiresAt: attempt.expiresAt.toISOString() };
}

export async function previewConnection(userId: number) {
  const attempt = await activeConnection(userId);
  return attempt?.status === "VERIFIED" ? connectionReview(prisma, attempt) : null;
}

export async function confirmConnection(userId: number, primary: unknown, revision: unknown) {
  const attempt = await activeConnection(userId);
  if (!attempt || !["current", "other"].includes(String(primary)) || typeof revision !== "string") throw expired();
  return prisma.$transaction(async tx => {
    const ids = [...new Set([userId, ...(attempt.targetUserId ? [attempt.targetUserId] : [])])].sort((a, b) => a - b);
    for (const id of ids) await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM account_connections WHERE id = ${attempt.id} FOR UPDATE`;
    const fresh = await tx.accountConnection.findUniqueOrThrow({ where: { id: attempt.id } });
    const review = await connectionReview(tx, fresh);
    if (revision !== review.revision) throw new ConnectionError("connections.changed");
    if (primary === "other" && !review.other) throw expired();
    const owner = await tx.account.findUnique({ where: { provider_providerAccountId: {
      provider: fresh.provider, providerAccountId: fresh.providerAccountId!,
    } } });
    if ((owner?.userId ?? null) !== fresh.targetUserId) throw new ConnectionError("connections.changed");
    const primaryId = primary === "other" ? review.other!.id : userId;
    if (review.other) {
      const sourceId = primaryId === userId ? review.other.id : userId;
      // Financial records, participant snapshots, friend/group rows and source
      // profile remain intact. Queries resolve their owner through this alias.
      await tx.user.updateMany({ where: { mergedIntoId: sourceId }, data: { mergedIntoId: primaryId, authVersion: { increment: 1 } } });
      await tx.user.update({ where: { id: sourceId }, data: { mergedIntoId: primaryId, authVersion: { increment: 1 } } });
      await tx.account.updateMany({ where: { userId: sourceId }, data: { userId: primaryId } });
    } else {
      await tx.account.create({ data: {
        userId: primaryId, provider: fresh.provider, providerAccountId: fresh.providerAccountId!, type: "oidc",
      } });
    }
    await tx.user.update({ where: { id: primaryId }, data: { authVersion: { increment: 1 } } });
    await tx.accountConnection.update({ where: { id: fresh.id }, data: {
      status: "COMPLETED", primaryUserId: primaryId, completedAt: new Date(),
    } });
    return { success: true, redirectTo: "/login?connected=1" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelConnection(userId: number) {
  const token = (await cookies()).get(connectionCookie)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) await prisma.accountConnection.updateMany({ where: {
    id: tokenHash(token), initiatorId: userId, status: { in: ["STARTED", "VERIFIED"] },
  }, data: { status: "CANCELLED", completedAt: new Date() } });
}
