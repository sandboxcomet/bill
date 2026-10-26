import { requireParticipantAccess } from "@/lib/server/payment-access";
import { AccessError, accessErrorResponse } from "@/lib/server/authorization";
import { linkParticipantAccount } from "@/lib/server/participant-account";
import { requireQuota } from "@/lib/server/quota";
import { paymentErrorResponse } from "@/lib/server/payments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const origin = new URL(process.env.AUTH_URL || request.url).origin;
    if (request.headers.get("origin") !== origin) throw new AccessError("Forbidden", 403);
    const { id, pid } = await params;
    const { userId, participant } = await requireParticipantAccess(request, id, pid, false, true);
    const body = await request.json().catch(() => null);
    if (body?.claimSelf !== true) throw new AccessError("payment.claimRequired", 409);
    await requireQuota(`participant-link:${userId}`, 20);
    await linkParticipantAccount(id, pid, userId, participant.bill.version);
    return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return error instanceof AccessError ? accessErrorResponse(error) : paymentErrorResponse(error);
  }
}
