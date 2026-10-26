"use client";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { request, jsonBody } from "@/lib/client";
import { useI18n } from "./LanguageProvider";
import { signInWithPasskey, passkeyClientError } from "@/lib/passkey-client";

type Provider = "google" | "line";
type Summary = {
  id: number; name: string; username: string | null; promptPayId: string | null;
  providers: string[]; bills: number; groups: number; friends: number;
};
type Review = {
  current: Summary; other: Summary | null; provider: string; profileName: string | null;
  revision: string; expiresAt: string;
};
type Connections = { providers: string[]; enabled: string[]; review: Review | null; reviewError?: string | null };
const providerName = (provider: string) => provider === "google" ? "Google" : "LINE";

export default function AccountConnections() {
  const { t, feedback } = useI18n();
  const { data: session } = useSession();
  const [data, setData] = useState<Connections | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [primary, setPrimary] = useState<"current" | "other" | "">("");
  const [confirmed, setConfirmed] = useState(false);
  const [stale, setStale] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    request<Connections>("/api/account-connections").then(result => {
      if (!active) return;
      setData(result);
      setPrimary(result.review && !result.review.other ? "current" : "");
      setConfirmed(false);
      setStale(false);
      const query = new URLSearchParams(window.location.search);
      const message = query.get("connectionError");
      if (result.reviewError) setError(result.reviewError);
      else if (message) setError(message === "alreadyLinked" ? "connections.alreadyLinked"
        : message === "start" ? "connections.startAgain" : "connections.expired");
      else if (query.get("connection") === "review" && !result.review) setError("connections.expired");
    }).catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  async function connect(provider: Provider) {
    setBusy(true); setError("");
    try {
      await request("/api/account-connections", { method: "POST", ...jsonBody({ action: "start", provider }) });
      await signIn(provider, { redirectTo: "/settings?connection=review#connections" });
    } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }

  async function cancel() {
    setBusy(true); setError("");
    try {
      await request("/api/account-connections", { method: "POST", ...jsonBody({ action: "cancel" }) });
      window.history.replaceState(null, "", "/settings#connections");
      setAttempt(value => value + 1);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.review || !primary || !confirmed || busy || stale) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ redirectTo: string }>("/api/account-connections", {
        method: "POST", ...jsonBody({ action: "confirm", primary, revision: data.review.revision }),
      });
      window.location.replace(result.redirectTo);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message); setBusy(false); setConfirmed(false);
      if (["connections.expired", "connections.changed", "connections.providerConflict"].includes(message)) {
        setStale(true); setPrimary("");
      }
    }
  }

  async function reauthenticate() {
    const provider = session?.user?.loginProvider;
    if (!provider) return;
    setBusy(true); setError("");
    try {
      await request("/api/account-connections", { method: "POST", ...jsonBody({ action: "cancel" }) });
      if (provider === "passkey") await signInWithPasskey("/settings#connections");
      else await signIn(provider, { redirectTo: "/settings#connections" });
    } catch (reason) { setError(passkeyClientError(reason)); setBusy(false); }
  }

  const review = data?.review;
  const selected = primary === "other" ? review?.other : primary === "current" ? review?.current : null;
  return <section id="connections" className="panel account-connections" aria-labelledby="connections-heading" aria-busy={busy || loading}>
    <h2 id="connections-heading">{t("connections.title")}</h2>
    <p className="field-hint">{t("connections.description")}</p>
    {loading ? <p role="status">{t("connections.loading")}</p> : review ?
      <form onSubmit={confirm}>
        <h3>{t(review.other ? "connections.choosePrimary" : "connections.linkTitle")}</h3>
        <p>{t(review.other ? "connections.chooseHint" : "connections.linkHint", [providerName(review.provider), review.profileName || providerName(review.provider)])}</p>
        <fieldset className="connection-choices" disabled={busy || stale}>
          <legend>{t(review.other ? "connections.primaryAccount" : "connections.keptAccount")}</legend>
          {([ ["current", review.current], ["other", review.other] ] as const).filter(([, account]) => account).map(([choice, account]) => account &&
            <label key={choice} className={`connection-choice${primary === choice ? " selected" : ""}`}>
              {review.other && <input type="radio" name="primaryAccount" value={choice} checked={primary === choice}
                onChange={() => { setPrimary(choice); setConfirmed(false); }} required />}
              <span className="connection-choice-details">
                <strong>{account.providers.map(providerName).join(" + ")} · {account.name || t("connections.unnamed")}</strong>
                <span>{account.username ? `@${account.username}` : t("connections.noUsername")}</span>
                <span>{t("settings.promptPayNumber")}: <b>{account.promptPayId || t("connections.notSet")}</b></span>
                <span>{t("connections.counts", [account.bills, account.groups])}</span>
              </span>
            </label>)}
        </fieldset>
        {selected && <p className="connection-selection" role="status">{t("connections.selection", [selected.name || selected.username || t("connections.unnamed")])}</p>}
        <p className="field-hint">{t("connections.preserveHint")}</p>
        <p className="field-hint">{t("connections.signInAgainHint")}</p>
        <label className="connection-confirm"><input type="checkbox" checked={confirmed} required disabled={busy || !primary || stale}
          onChange={event => setConfirmed(event.target.checked)} /><span>{t("connections.confirmCheck")}</span></label>
        <div className="connection-actions">
          <button type="submit" className="button primary" disabled={busy || !primary || !confirmed || stale}>
            {t(busy ? "common.saving" : review.other ? "connections.confirmMerge" : "connections.confirmLink")}</button>
          <button type="button" className="button secondary" disabled={busy} onClick={cancel}>{t(stale ? "connections.startOver" : "common.cancel")}</button>
        </div>
      </form>
      : data ? <ul className="connection-providers">
        {(["google", "line"] as const).map(provider => <li key={provider}>
          <div><strong>{providerName(provider)}</strong><span>{t(data.providers.includes(provider) ? "connections.linked" : "connections.notLinked")}</span></div>
          {!data.providers.includes(provider) && <button type="button" className="button secondary" disabled={busy || !data.enabled.includes(provider)}
            onClick={() => connect(provider)}>{t(data.enabled.includes(provider) ? "connections.connect" : "connections.unavailable", [providerName(provider)])}</button>}
        </li>)}
      </ul> : <button type="button" className="button secondary" onClick={() => { setError(""); setAttempt(value => value + 1); }}>{t("common.retry")}</button>}
    {error && <div role="alert"><p className="error">{feedback(error)}</p>
      {error === "connections.reauthenticate" && session?.user?.loginProvider &&
        <button type="button" className="button secondary" disabled={busy} onClick={reauthenticate}>{t("connections.verifyCurrent")}</button>}
      {data && !review && error !== "connections.reauthenticate" && <button type="button" className="button secondary" disabled={busy} onClick={cancel}>{t("connections.startOver")}</button>}
    </div>}
  </section>;
}
