"use client";
import { browserSupportsWebAuthn, startAuthentication } from "@wonglao/webauthn-browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@wonglao/webauthn-browser";
import { signIn } from "next-auth/react";
import { request } from "./client";
import { safeAccountReturn } from "./social";

export function passkeysSupported() {
  return window.isSecureContext && browserSupportsWebAuthn();
}

export function passkeyClientError(error: unknown) {
  const reason = error as { name?: string; code?: string; message?: string };
  if (reason?.name === "NotAllowedError" || reason?.name === "AbortError" ||
      reason?.code === "ERROR_CEREMONY_ABORTED") return "passkeys.cancelled";
  if (reason?.name === "InvalidStateError") return "passkeys.exists";
  if (reason?.name === "NotSupportedError" || reason?.name === "SecurityError") return "passkeys.unsupported";
  return reason?.message || "passkeys.failed";
}

export async function signInWithPasskey(destination: string) {
  if (!passkeysSupported()) throw new Error("passkeys.unsupported");
  const options = await request<PublicKeyCredentialRequestOptionsJSON>("/api/passkeys/authentication/options", { method: "POST" });
  const response = await startAuthentication({ optionsJSON: options });
  const result = await signIn("passkey", { response: JSON.stringify(response), redirect: false, redirectTo: safeAccountReturn(destination) });
  if (!result || result.error) throw new Error("passkeys.invalid");
  const target = new URL(result.url || safeAccountReturn(destination), window.location.origin);
  if (target.origin !== window.location.origin) throw new Error("passkeys.invalid");
  window.location.assign(target.href);
}
