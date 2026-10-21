"use client";
import { useEffect, useState } from "react";
import type { AccountPerson, SavedGroup } from "@/lib/social";
import { request } from "@/lib/client";
import { useI18n } from "./LanguageProvider";
import AccountSearch from "./AccountSearch";
import Link from "./LocalizedLink";
export default function BillPeoplePicker({ onAdd, disabled }: { onAdd: (people: AccountPerson[]) => void; disabled: boolean }) {
  const { t, feedback } = useI18n();
  const [open, setOpen] = useState(false); const [friends, setFriends] = useState<AccountPerson[]>([]); const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true; setLoading(true); setError("");
    Promise.all([request<{ friends: { status: string; person: AccountPerson }[] }>("/api/friends"), request<{ groups: SavedGroup[] }>("/api/friend-groups")])
      .then(([a, b]) => { if (active) { setFriends(a.friends.filter(f => f.status === "ACCEPTED").map(f => f.person)); setGroups(b.groups); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, attempt]);
  return <details className="bill-people-picker" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>{t("social.addFromAccount")}</summary>
    <p className="field-hint">{t("social.billAutoFriendHint")}</p>
    {open && <>
      <AccountSearch onSelect={person => onAdd([person])} disabled={disabled} />
      {loading && <p role="status">{t("social.loading")}</p>}
      {error && <p className="error" role="alert">{feedback(error)} <button type="button" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
      {friends.length > 0 && <div className="social-picker-section"><strong>{t("social.friendsShort")}</strong><div className="allocation-chips">{friends.map(p => <button className="allocation-chip" type="button" disabled={disabled} key={p.id} onClick={() => onAdd([p])}>{p.name} <small>@{p.username}</small></button>)}</div></div>}
      {groups.length > 0 && <div className="social-picker-section"><strong>{t("social.groupsHeading")}</strong><div className="allocation-chips">{groups.map(group => <button className="allocation-chip" type="button" disabled={disabled} key={group.id} onClick={() => onAdd(group.members)}>{group.name}</button>)}</div></div>}
      <Link className="text-link" href="/friends">{t("social.manageFriends")}</Link>
    </>}
  </details>;
}
