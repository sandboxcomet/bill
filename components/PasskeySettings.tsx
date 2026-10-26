"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from "@wonglao/webauthn-browser";
import { useI18n } from "./LanguageProvider";
import { Icon } from "./Icons";
import { jsonBody, request } from "@/lib/client";
import { passkeysSupported, signInWithPasskey, passkeyClientError } from "@/lib/passkey-client";
type Key = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

export default function PasskeySettings({ provider }: { provider: "google" | "line" | "passkey" | null }) {
  const { t, feedback, formatLocale } = useI18n();
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [supported, setSupported] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setSupported(passkeysSupported());
    let active = true;
    request<{ passkeys: Key[] }>("/api/passkeys").then(data => { if (active) setKeys(data.passkeys); })
      .catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [attempt]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setSuccess(false); setConfirming("");
    try {
      const options = await request<PublicKeyCredentialCreationOptionsJSON>("/api/passkeys/registration/options", { method: "POST" });
      const response = await startRegistration({ optionsJSON: options });
      await request("/api/passkeys/registration/verify", { method: "POST", ...jsonBody({ response, name: name.trim() || t("passkeys.defaultName") }) });
      setSuccess(true); setName(""); setAttempt(value => value + 1);
    } catch (reason) { setError(passkeyClientError(reason)); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    if (busy) return;
    setBusy(true); setError(""); setSuccess(false);
    try {
      await request("/api/passkeys", { method: "PATCH", ...jsonBody({ id }) });
      // The server also invalidates sessions authenticated by this credential.
      window.location.reload();
    } catch (reason) { setError(passkeyClientError(reason)); setBusy(false); }
  }

  async function reauthenticate() {
    if (!provider || busy) return;
    setBusy(true); setError("");
    try {
      if (provider === "passkey") await signInWithPasskey("/settings#passkeys");
      else await signIn(provider, { redirectTo: "/settings#passkeys" });
    } catch (reason) { setError(passkeyClientError(reason)); setBusy(false); }
  }

  const date = (value: string) => new Date(value).toLocaleDateString(formatLocale, { day: "numeric", month: "short", year: "numeric" });
  return <section id="passkeys" className="panel passkey-settings" aria-labelledby="passkeys-heading" aria-busy={busy}>
    <div className="panel-heading"><h2 id="passkeys-heading">{t("passkeys.title")}</h2><Icon name="key" /></div>
    <p className="field-hint">{t("passkeys.description")}</p>
    <p className="field-hint">{t("passkeys.recoveryHint")}</p>
    {keys === null ? error ? <button type="button" className="button secondary" onClick={() => { setError(""); setAttempt(value => value + 1); }}>{t("common.retry")}</button>
      : <p role="status">{t("passkeys.loading")}</p>
      : <>
        {keys.length ? <ul className="passkey-list">{keys.map(key => <li key={key.id}>
          <div className="passkey-key-heading"><div><strong>{key.name}</strong><small>{t("passkeys.created", [date(key.createdAt)])}</small>
            <small>{key.lastUsedAt ? t("passkeys.lastUsed", [date(key.lastUsedAt)]) : t("passkeys.neverUsed")}</small></div>
            <button type="button" className="button secondary" disabled={busy} aria-expanded={confirming === key.id}
              aria-label={t("passkeys.disableNamed", [key.name])} onClick={() => setConfirming(confirming === key.id ? "" : key.id)}>{t("passkeys.disable")}</button>
          </div>
          {confirming === key.id && <div className="passkey-revoke"><p>{t("passkeys.disableConfirm", [key.name])}</p><div className="connection-actions">
            <button type="button" className="button secondary" disabled={busy} onClick={() => revoke(key.id)}>{t("passkeys.confirmDisable")}</button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => setConfirming("")}>{t("common.cancel")}</button>
          </div></div>}
        </li>)}</ul> : <p className="passkey-empty">{t("passkeys.empty")}</p>}
        {supported ? <form onSubmit={add}>
          <label className="field"><span>{t("passkeys.name")}</span><input maxLength={80} value={name} disabled={busy} placeholder={t("passkeys.namePlaceholder")} onChange={event => setName(event.target.value)} /></label>
          <button className="button primary" disabled={busy || keys.length >= 10}><Icon name="plus" size={17} />{t(busy ? "passkeys.verifying" : "passkeys.add")}</button>
          {keys.length >= 10 && <p className="field-hint">{t("passkeys.limit")}</p>}
        </form> : <p className="notice">{t("passkeys.unsupported")}</p>}
      </>}
    {success && <p className="success" role="status">{t("passkeys.added")}</p>}
    {error && <div role="alert"><p className="error">{feedback(error)}</p>
      {error === "passkeys.reauthenticate" && provider && <button type="button" className="button secondary" disabled={busy} onClick={reauthenticate}>{t("connections.verifyCurrent")}</button>}
    </div>}
  </section>;
}
