import { registrationOptions, requirePasskeyOrigin } from "@/lib/server/passkeys";
import { passkeyResponse } from "@/lib/server/passkey-http";

export async function POST(request: Request) {
  return passkeyResponse(async () => {
    requirePasskeyOrigin(request);
    return registrationOptions();
  });
}
