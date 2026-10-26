import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUserId, accessErrorResponse, AccessError } from "@/lib/server/authorization";
import { requireQuota } from "@/lib/server/quota";
import { PaymentError } from "@/lib/payment-contract";
import { isLoginProvider, startConnection, previewConnection, confirmConnection, cancelConnection, ConnectionError } from "@/lib/server/account-connections";

const headers = { "Cache-Control": "private, no-store" };
async function respond(work: () => Promise<unknown>) {
  try { return Response.json(await work(), { headers }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code))
      return Response.json({ error: "connections.changed" }, { status: 409, headers });
    if (error instanceof ConnectionError || error instanceof PaymentError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    return accessErrorResponse(error);
  }
}

export async function GET() {
  return respond(async () => {
    const userId = await requireUserId(false);
    const accounts = await prisma.account.findMany({ where: { userId }, select: { provider: true } });
    let review = null;
    let reviewError = null;
    try { review = await previewConnection(userId); }
    catch (error) { if (error instanceof ConnectionError) reviewError = error.message; else throw error; }
    return { providers: [...new Set(accounts.map(account => account.provider))],
      enabled: ["google", "line"].filter(provider => process.env[`AUTH_${provider.toUpperCase()}_ID`] && process.env[`AUTH_${provider.toUpperCase()}_SECRET`]),
      review, reviewError };
  });
}

export async function POST(request: Request) {
  return respond(async () => {
    const origin = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(request.url).origin;
    if (request.headers.get("origin") !== origin) throw new AccessError("Forbidden", 403);
    const userId = await requireUserId(false);
    await requireQuota(`account-connect:${userId}`, 20);
    const body = await request.json().catch(() => null);
    if (body?.action === "cancel") { await cancelConnection(userId); return { success: true }; }
    if (body?.action === "confirm") return confirmConnection(userId, body.primary, body.revision);
    if (body?.action !== "start" || !isLoginProvider(body.provider)) throw new ConnectionError("connections.invalid");
    const prefix = `AUTH_${body.provider.toUpperCase()}`;
    if (!process.env[`${prefix}_ID`] || !process.env[`${prefix}_SECRET`]) throw new ConnectionError("connections.unavailable");
    await startConnection(userId, body.provider);
    return { success: true };
  });
}
