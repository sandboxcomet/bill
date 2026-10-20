import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class AccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 404 | 409 = 403,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export async function requireUserId(): Promise<number> {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new AccessError("Unauthorized", 401);
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
