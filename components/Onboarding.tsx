"use client";
import { useState } from "react";
import { useI18n } from "./LanguageProvider";
import { isUsername, normalizeUsername } from "@/lib/social";
import { jsonBody, request } from "@/lib/client";
import { isNickname } from "@/lib/profile";
export default function Onboarding({ destination, initialUsername = "", initialNickname = "" }: { destination: string; initialUsername?: string; initialNickname?: string }) {
  const { t, feedback } = useI18n();
  const [username, setUsername] = useState(initialUsername);
  const [nickname, setNickname] = useState(initialNickname);
  const [usernameError, setUsernameError] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const value = normalizeUsername(username);
    const validUsername = isUsername(value), validNickname = isNickname(nickname);
    setUsernameError(validUsername ? "" : "account.usernameInvalid");
    setNicknameError(validNickname ? "" : "errors.nicknameInvalid");
    if (!validUsername || !validNickname) return;
    setBusy(true); setError("");
    try {
      await request("/api/profile", { method: "PATCH", ...jsonBody({ ...(!initialUsername ? { username: value } : {}), nickname: nickname.trim() }) });
      // Start one fresh request after saving. Refreshing onboarding while a
      // client navigation is pending can render its redirect again.
      window.location.replace(destination);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div id="content" className="settings-page account-setup">
    <h1>{t("account.setupTitle")}</h1><p>{t("account.setupHint")}</p>
    <form className="panel" onSubmit={submit} aria-busy={busy} noValidate>
      <label className="field"><span>{t("account.username")}</span><input autoFocus={!initialUsername} autoComplete="username" autoCapitalize="none" spellCheck={false}
        value={username} onChange={e => { setUsername(e.target.value); setUsernameError(""); setError(""); }} maxLength={25} placeholder="ponnn" disabled={busy} readOnly={Boolean(initialUsername)} required
        aria-invalid={Boolean(usernameError)} aria-describedby={usernameError ? "username-hint username-error" : "username-hint"} /></label>
      <p id="username-hint" className="field-hint">{t(initialUsername ? "account.usernameImmutableHint" : "account.usernameHint")}</p>
      {usernameError && <p id="username-error" className="error" role="alert">{feedback(usernameError)}</p>}
      <label className="field"><span>{t("settings.yourNickname")}</span><input autoFocus={Boolean(initialUsername)} autoComplete="nickname" required maxLength={40}
        value={nickname} onChange={e => { setNickname(e.target.value); setNicknameError(""); setError(""); }} disabled={busy}
        aria-invalid={Boolean(nicknameError)} aria-describedby={nicknameError ? "nickname-hint nickname-error" : "nickname-hint"} /></label>
      <p id="nickname-hint" className="field-hint">{t("settings.nicknameHint")}</p>
      {nicknameError && <p id="nickname-error" className="error" role="alert">{feedback(nicknameError)}</p>}
      {error && <p className="error" role="alert">{feedback(error)}</p>}
      <button className="button primary full-width" disabled={busy}>{busy ? t("common.saving") : t("account.saveUsername")}</button>
    </form>
  </div>;
}
