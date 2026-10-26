import { Prisma } from "@prisma/client";
import { PasskeyError } from "./passkeys";
import { PaymentError } from "@/lib/payment-contract";

export async function passkeyResponse(work: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json(await work(), { headers }); }
  catch (error) {
    if (error instanceof PasskeyError || error instanceof PaymentError) {
      return Response.json({ error: error.message }, { status: error.status, headers });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "passkeys.exists" }, { status: 409, headers });
    }
    console.error("[passkey] Request failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "passkeys.failed" }, { status: 500, headers });
  }
}

export async function passkeyBody(request: Request) {
  const body = await request.text();
  if (body.length > 40000) throw new PasskeyError("passkeys.invalid");
  try { return JSON.parse(body); } catch { throw new PasskeyError("passkeys.invalid"); }
}
