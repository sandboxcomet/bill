"use client";
import { useState } from "react";
import { useI18n } from "./LanguageProvider";
import { isUsername, normalizeUsername } from "@/lib/social";
import { jsonBody, request } from "@/lib/client";
export default function Onboarding({ destination }: { destination: string }) {
  const { t, feedback } = useI18n();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const value = normalizeUsername(username);
    if (!isUsername(value)) { setError("account.usernameInvalid"); return; }
    setBusy(true); setError("");
    try {
      await request("/api/profile", { method: "PATCH", ...jsonBody({ username: value }) });
      // Start one fresh request after saving. Refreshing onboarding while a
      // client navigation is pending can render its redirect again.
      window.location.replace(destination);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div id="content" className="settings-page account-setup">
    <h1>{t("account.setupTitle")}</h1><p>{t("account.setupHint")}</p>
    <form className="panel" onSubmit={submit} aria-busy={busy}>
      <label className="field"><span>{t("account.username")}</span><input autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false}
        value={username} onChange={e => { setUsername(e.target.value); setError(""); }} maxLength={25} placeholder="@ponnn" disabled={busy}
        aria-invalid={Boolean(error)} aria-describedby="username-hint" /></label>
      <p id="username-hint" className="field-hint">{t("account.usernameHint")}</p>
      {error && <p className="error" role="alert">{feedback(error)}</p>}
      <button className="button primary full-width" disabled={busy}>{busy ? t("common.saving") : t("account.saveUsername")}</button>
    </form>
  </div>;
}
