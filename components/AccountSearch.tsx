"use client";
import { useRef, useState } from "react";
import type { AccountPerson, PersonResult } from "@/lib/social";
import { jsonBody, request } from "@/lib/client";
import { useI18n } from "./LanguageProvider";
import { nameInitial } from "@/lib/name-initial";
export default function AccountSearch({ onSelect, onChanged, disabled = false }: {
  onSelect?: (person: AccountPerson) => void;
  onChanged?: () => void;
  disabled?: boolean;
}) {
  const { t, feedback } = useI18n();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PersonResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  async function search(event: React.FormEvent) {
    event.preventDefault(); if (busy || disabled) return;
    const revision = ++sequence.current;
    setBusy(true); setError(""); setResult(null); setSearched(false);
    try {
      const response = await request<{ person: PersonResult | null }>("/api/people/search", { method: "POST", ...jsonBody({ query }) });
      if (revision !== sequence.current) return;
      setResult(response.person); setSearched(true);
    } catch (e) { if (revision === sequence.current) setError((e as Error).message); }
    finally { if (revision === sequence.current) setBusy(false); }
  }
  async function invite() {
    if (!result || busy) return;
    setBusy(true); setError("");
    try { await request("/api/friends", { method: "POST", ...jsonBody({ userId: result.id }) }); setResult({ ...result, relationship: "PENDING_SENT" }); onChanged?.(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="account-search">
    <form className="inline-form" onSubmit={search}>
      <input aria-label={t("social.searchLabel")} placeholder={t("social.searchPlaceholder")} value={query} autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={254} disabled={busy || disabled}
        onChange={e => { setQuery(e.target.value); setResult(null); setSearched(false); setError(""); }} />
      <button className="button secondary" disabled={busy || disabled || !query.trim()}>{busy ? t("social.searching") : t("social.search")}</button>
    </form>
    {error && <p className="error" role="alert">{feedback(error)}</p>}
    {searched && !result && <p className="field-hint" role="status">{t("social.personNotFound")}</p>}
    {result && <div className="social-person-row">
      <span className="avatar small social-avatar" aria-hidden="true">{nameInitial(result.name)}{result.image && <img src={result.image} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.hidden = true; }} />}</span>
      <div className="social-person-info"><strong>{result.name}</strong><small>@{result.username}</small>
        <span className="field-hint">{result.relationship === "FRIEND" ? t("social.friendsStatus") : result.relationship === "PENDING_SENT" ? t("social.pendingSent") : result.relationship === "PENDING_RECEIVED" ? t("social.pendingReceived") : t("social.notFriends")}</span>
      </div>
      {onSelect ? <button type="button" className="button secondary" disabled={busy || disabled} onClick={() => { onSelect(result); setResult(null); setQuery(""); setSearched(false); }}>{t("social.selectPerson")}</button>
        : result.relationship === "NONE" && <button type="button" className="button secondary" disabled={busy || disabled} onClick={invite}>{t("social.addFriend")}</button>}
    </div>}
  </div>;
}
