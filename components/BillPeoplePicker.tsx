"use client";
import { useEffect, useState } from "react";
import type { AccountPerson, SavedGroup } from "@/lib/social";
import { request } from "@/lib/client";
import { useI18n } from "./LanguageProvider";
import AccountSearch from "./AccountSearch";
import Link from "./LocalizedLink";
export default function BillPeoplePicker({ onAdd, disabled, selectedAccountIds }: {
  onAdd: (people: AccountPerson[]) => void; disabled: boolean; selectedAccountIds: number[];
}) {
  const { t, feedback } = useI18n();
  const [open, setOpen] = useState(false); const [friends, setFriends] = useState<AccountPerson[]>([]); const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true); const [friendsError, setFriendsError] = useState(""); const [friendAttempt, setFriendAttempt] = useState(0);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setFriendsLoading(true); setFriendsError("");
    request<{ friends: { status: string; person: AccountPerson }[] }>("/api/friends")
      .then(result => { if (active) setFriends(result.friends.filter(friend => friend.status === "ACCEPTED").map(friend => friend.person)); })
      .catch(error => { if (active) setFriendsError(error.message); })
      .finally(() => { if (active) setFriendsLoading(false); });
    return () => { active = false; };
  }, [friendAttempt]);
  useEffect(() => {
    if (!open) return;
    let active = true; setLoading(true); setError("");
    request<{ groups: SavedGroup[] }>("/api/friend-groups")
      .then(result => { if (active) setGroups(result.groups); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, attempt]);
  const available = friends.filter(friend => !selectedAccountIds.includes(friend.id));
  return <div className="bill-account-picker">
    <label className="field friend-dropdown"><span>{t("social.chooseFriend")}</span>
      <select value="" disabled={disabled || friendsLoading || Boolean(friendsError) || !available.length}
        onChange={event => {
          const person = available.find(friend => friend.id === Number(event.target.value));
          if (person && !disabled) onAdd([person]);
        }}>
        <option value="">{t(friendsLoading ? "social.loadingFriends" : !available.length && friends.length ? "social.allFriendsAdded" : "social.chooseFriendHint")}</option>
        {available.map(friend => <option key={friend.id} value={friend.id}>{friend.name} · @{friend.username}</option>)}
      </select>
    </label>
    {friendsError ? <p className="error" role="alert">{feedback(friendsError)} <button type="button" className="text-link" disabled={disabled || friendsLoading} onClick={() => setFriendAttempt(value => value + 1)}>{t("common.retry")}</button></p>
      : !friendsLoading && !friends.length && <p className="field-hint">{t("social.noAcceptedFriends")} <Link className="text-link" href="/friends">{t("social.manageFriends")}</Link></p>}
    <details className="bill-people-picker" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>{t("social.addFromAccount")}</summary>
    <p className="field-hint">{t("social.billAutoFriendHint")}</p>
    {open && <>
      <AccountSearch onSelect={person => onAdd([person])} disabled={disabled} />
      {loading && <p role="status">{t("social.loadingGroups")}</p>}
      {error && <p className="error" role="alert">{feedback(error)} <button type="button" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
      {groups.length > 0 && <div className="social-picker-section"><strong>{t("social.groupsHeading")}</strong><div className="allocation-chips">{groups.map(group => <button className="allocation-chip" type="button" disabled={disabled} key={group.id} onClick={() => onAdd(group.members)}>{group.name}</button>)}</div></div>}
      <Link className="text-link" href="/friends">{t("social.manageFriends")}</Link>
    </>}
    </details>
  </div>;
}
