"use client";
import { useEffect, useState } from "react";
import { useI18n } from "./LanguageProvider";
import { Icon } from "./Icons";
import { passkeysSupported, signInWithPasskey, passkeyClientError } from "@/lib/passkey-client";

export default function PasskeyLogin({ destination }: { destination: string }) {
  const { t, feedback } = useI18n();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setSupported(passkeysSupported()); }, []);
  async function login() {
    if (busy) return;
    setBusy(true); setError("");
    try { await signInWithPasskey(destination); }
    catch (reason) { setError(passkeyClientError(reason)); setBusy(false); }
  }
  return <div className="passkey-login">
    <button type="button" className="button secondary full-width provider-button" disabled={!supported || busy} onClick={login}>
      <Icon name="key" size={22} /><span>{t(busy ? "passkeys.verifying" : "passkeys.signIn")}</span>
    </button>
    <p className="field-hint">{t(supported === false ? "passkeys.unsupported" : "passkeys.loginHint")}</p>
    {error && <p className="error" role="alert">{feedback(error)}</p>}
  </div>;
}
