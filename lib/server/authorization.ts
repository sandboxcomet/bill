import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isNickname } from "@/lib/profile";
import { isUsername } from "@/lib/social";

export class AccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 404 | 409 = 403,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export async function optionalUserId(): Promise<number | null> {
  const session = await auth();
  const id = Number(session?.user?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function requireUserId(requireUsername = true): Promise<number> {
  const id = await optionalUserId();
  if (id === null) throw new AccessError("Unauthorized", 401);
  if (requireUsername) {
    const user = await prisma.user.findUnique({ where: { id }, select: { username: true, nickname: true } });
    if (!user?.username || !isUsername(user.username)) throw new AccessError("account.usernameRequired", 403);
    if (!isNickname(user.nickname)) throw new AccessError("account.nicknameRequired", 403);
  }
  return id;
}

export function accessErrorResponse(error: unknown): Response {
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(
    "[request] Operation failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "Unable to complete the request" },
    { status: 500 },
  );
}
