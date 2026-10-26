import { registerPasskey, requirePasskeyOrigin } from "@/lib/server/passkeys";
import { passkeyResponse, passkeyBody } from "@/lib/server/passkey-http";

export async function POST(request: Request) {
  return passkeyResponse(async () => {
    requirePasskeyOrigin(request);
    const body = await passkeyBody(request);
    await registerPasskey(body?.response, body?.name);
    return { success: true };
  });
}
