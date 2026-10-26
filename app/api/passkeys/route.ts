import { listPasskeys, revokePasskey, requirePasskeyOrigin } from "@/lib/server/passkeys";
import { passkeyResponse, passkeyBody } from "@/lib/server/passkey-http";

export async function GET() {
  return passkeyResponse(async () => ({ passkeys: await listPasskeys() }));
}

export async function PATCH(request: Request) {
  return passkeyResponse(async () => {
    requirePasskeyOrigin(request);
    const body = await passkeyBody(request);
    await revokePasskey(body?.id);
    return { success: true };
  });
}
