"use client";
import { useEffect, useState } from "react";
import { useI18n, useLocalizedRouter } from "./LanguageProvider";
import { jsonBody, request } from "@/lib/client";
import type { AccountPerson, SavedGroup } from "@/lib/social";
import AccountSearch from "./AccountSearch";
import { nameInitial } from "@/lib/name-initial";
import { Icon } from "./Icons";
import styles from "./Friends.module.css";
type FriendRow = { id: string; status: string; source: string; incoming: boolean; person: AccountPerson };
export default function Friends() {
  const { t, feedback } = useI18n(); const router = useLocalizedRouter();
  const [friends, setFriends] = useState<FriendRow[]>([]); const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [selected, setSelected] = useState<AccountPerson[]>([]); const [name, setName] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0); const [message, setMessage] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [friendLimit, setFriendLimit] = useState(24);
  useEffect(() => {
    let active = true; setError("");
    Promise.all([request<{ friends: FriendRow[] }>("/api/friends"), request<{ groups: SavedGroup[] }>("/api/friend-groups")])
      .then(([a, b]) => { if (active) { setFriends(a.friends); setGroups(b.groups); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const refresh = () => setAttempt(n => n + 1);
  function select(person: AccountPerson) { setSelected(current => current.some(p => p.id === person.id) ? current : [...current, person]); }
  async function respond(id: string, action: "accept" | "decline") {
    if (busy) return; setBusy(true); setError("");
    try { await request("/api/friends", { method: "PATCH", ...jsonBody({ id, action }) }); refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function createGroup(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    try { await request("/api/friend-groups", { method: "POST", ...jsonBody({ name, memberIds: selected.map(p => p.id) }) });
      setName(""); setSelected([]); setMessage("social.groupSaved"); refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const accepted = friends.filter(f => f.status === "ACCEPTED");
  const pending = friends.filter(f => f.status === "PENDING");
  const aliases = new Map(friends.map(row => [row.person.id, row.person.ownerAlias]));
  const displayName = (person: AccountPerson) => aliases.get(person.id) || person.ownerAlias || person.name;
  const search = friendQuery.trim().toLocaleLowerCase();
  const filteredFriends = accepted.filter(({ person }) => [displayName(person), person.name, person.username, `@${person.username}`]
    .some(value => value.toLocaleLowerCase().includes(search)));
  const visibleFriends = filteredFriends.slice(0, friendLimit);
  return <div id="content" className="friends-page">
    <h1>{t("social.pageTitle")}</h1><p className="muted">{t("social.intro")}</p>
    <section className="panel"><h2>{t("social.findFriend")}</h2><AccountSearch onChanged={refresh} disabled={busy} /><p className="field-hint">{t("social.searchPrivacy")}</p></section>
    {error && <div className="error" role="alert">{feedback(error)} <button className="text-link" onClick={refresh}>{t("common.retry")}</button></div>}
    {message && <p className="success" role="status">{feedback(message)}</p>}
    {loading ? <p role="status">{t("social.loading")}</p> : <>
      {pending.length > 0 && <section className="panel" id="friend-requests"><h2>{t("social.requests")}</h2>{pending.map(row => <div className="social-person-row" key={row.id}>
        <div className="social-person-info"><strong>{displayName(row.person)}</strong><small>@{row.person.username} · {t(row.incoming ? "social.pendingReceived" : "social.pendingSent")}</small></div>
        {row.incoming && <div className="social-row-actions"><button className="button secondary" disabled={busy} onClick={() => respond(row.id, "accept")}>{t("social.accept")}</button><button className="button share-link-button" disabled={busy} onClick={() => respond(row.id, "decline")}>{t("social.decline")}</button></div>}
      </div>)}</section>}
      <section className="panel"><h2>{t("social.friendsHeading", [accepted.length])}</h2>
        {!accepted.length && <p className="field-hint">{t("social.noFriends")}</p>}
        {accepted.length > 0 && <>
          <label className={`field ${styles.filter}`}><span>{t("social.filterFriends")}</span>
            <input type="search" value={friendQuery} placeholder={t("social.filterFriendsPlaceholder")}
              onChange={e => { setFriendQuery(e.target.value); setFriendLimit(24); }} />
          </label>
          {!filteredFriends.length && <p className="field-hint" role="status">{t("social.noMatchingFriends")}</p>}
          <ul className={styles.grid}>
            {visibleFriends.map(row => <li className={styles.item} key={row.id}>
              <span className={`avatar social-avatar ${styles.avatar}`} aria-hidden="true">{nameInitial(displayName(row.person))}{row.person.image && <img src={row.person.image} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.hidden = true; }} />}</span>
              <div className={styles.person}><strong>{displayName(row.person)}</strong><span>{row.person.ownerAlias && row.person.ownerAlias !== row.person.name ? `${row.person.name} · ` : ""}@{row.person.username}</span></div>
            </li>)}
          </ul>
          {visibleFriends.length < filteredFriends.length && <div className={styles.more}><span className="field-hint">{t("social.friendsShown", [visibleFriends.length, filteredFriends.length])}</span><button type="button" className="button secondary button-small" onClick={() => setFriendLimit(limit => limit + 24)}>{t("social.showMoreFriends")}</button></div>}
        </>}
      </section>
      <section className="panel"><h2>{t("social.groupsHeading")}</h2>
        {!groups.length && <p className="field-hint">{t("social.noGroups")}</p>}
        {groups.map(group => <div className="social-person-row" key={group.id}><div className="social-person-info"><strong>{group.name}</strong><small>{group.members.map(displayName).join(", ")}</small></div><button className="button secondary" onClick={() => router.push(`/new?group=${encodeURIComponent(group.id)}&round=${crypto.randomUUID()}`)}><Icon name="plus" size={16} />{t("bill.create")}</button></div>)}
        <details className="social-group-form"><summary>{t("social.createGroup")}</summary>
          <label className="field"><span>{t("social.groupName")}</span><input form="new-friend-group" value={name} onChange={e => setName(e.target.value)} maxLength={80} disabled={busy} placeholder={t("social.groupNamePlaceholder")} /></label>
          <p className="field-hint">{t("social.autoFriendHint")}</p>
          <div className="social-member-options">{accepted.map(row => <label key={row.person.id}><input type="checkbox" disabled={busy} checked={selected.some(p => p.id === row.person.id)} onChange={e => e.target.checked ? select(row.person) : setSelected(current => current.filter(p => p.id !== row.person.id))} />{displayName(row.person)}</label>)}</div>
          <AccountSearch onSelect={select} disabled={busy} />
          {selected.length > 0 && <div className="people-list">{selected.map(person => <span className="person-chip" key={person.id}>{displayName(person)}<button className="chip-remove" disabled={busy} aria-label={t("social.unselectPerson", [displayName(person)])} onClick={() => setSelected(current => current.filter(p => p.id !== person.id))}><Icon name="close" size={13} /></button></span>)}</div>}
          <form id="new-friend-group" onSubmit={createGroup}><button className="button primary" disabled={busy || !name.trim() || !selected.length}>{busy ? t("common.saving") : t("social.saveGroup")}</button></form>
        </details>
      </section>
    </>}
  </div>;
}
