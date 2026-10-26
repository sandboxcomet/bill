"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { AccountPerson, SavedGroup } from "@/lib/social";
import { isUsername, normalizeUsername } from "@/lib/social";
import { jsonBody, request } from "@/lib/client";
import { useI18n } from "./LanguageProvider";
import Link from "./LocalizedLink";
import { Icon } from "./Icons";

type Choice = { key: string; label: string; detail?: string; run: () => void };
export default function BillPeoplePicker({ onAdd, onAddName, disabled, selectedAccountIds, allowAccounts = true }: {
  onAdd: (people: AccountPerson[]) => boolean;
  onAddName: (name: string) => boolean;
  disabled: boolean;
  selectedAccountIds: number[];
  allowAccounts?: boolean;
}) {
  const { t, feedback } = useI18n();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const searchCache = useRef(new Map<string, AccountPerson | null>());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [friends, setFriends] = useState<AccountPerson[]>([]);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(allowAccounts);
  const [groupsLoading, setGroupsLoading] = useState(allowAccounts);
  const [friendsError, setFriendsError] = useState("");
  const [groupsError, setGroupsError] = useState("");
  const [friendAttempt, setFriendAttempt] = useState(0);
  const [groupAttempt, setGroupAttempt] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [person, setPerson] = useState<AccountPerson | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (!allowAccounts) return;
    let live = true;
    setFriendsLoading(true); setFriendsError("");
    request<{ friends: { status: string; person: AccountPerson }[] }>("/api/friends")
      .then(result => { if (live) setFriends(result.friends.filter(friend => friend.status === "ACCEPTED").map(friend => friend.person)); })
      .catch(error => { if (live) setFriendsError(error.message); })
      .finally(() => { if (live) setFriendsLoading(false); });
    return () => { live = false; };
  }, [allowAccounts, friendAttempt]);
  useEffect(() => {
    if (!allowAccounts) return;
    let live = true;
    setGroupsLoading(true); setGroupsError("");
    request<{ groups: SavedGroup[] }>("/api/friend-groups")
      .then(result => { if (live) setGroups(result.groups); })
      .catch(error => { if (live) setGroupsError(error.message); })
      .finally(() => { if (live) setGroupsLoading(false); });
    return () => { live = false; };
  }, [allowAccounts, groupAttempt]);
  useEffect(() => () => { revision.current++; }, []);
  function reset() {
    revision.current++; setQuery(""); setPerson(null); setSearched(false);
    setSearchError(""); setSearching(false); setActive(-1); setOpen(false);
    input.current?.focus();
  }
  function addAccounts(people: AccountPerson[]) {
    if (!disabled && onAdd(people)) reset();
  }
  const value = query.trim();
  const filter = value.toLocaleLowerCase();
  const matches = (name: string) => name.toLocaleLowerCase().includes(filter);
  const canSearch = allowAccounts && (isUsername(normalizeUsername(value)) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  const accountQuery = value.includes("@");
  const availableFriends = friends.filter(friend => !selectedAccountIds.includes(friend.id) && (matches(friend.name) || matches(`@${friend.username}`)));
  const availableGroups = groups.filter(group => group.members.some(member => !selectedAccountIds.includes(member.id)) && matches(group.name));
  const knownFriend = friends.find(friend => friend.username === normalizeUsername(value));
  const expanded = open && !disabled;
  useEffect(() => {
    const current = ++revision.current;
    if (!expanded || !canSearch || composing) { setSearching(false); return; }
    const key = value.startsWith("@") ? normalizeUsername(value) : value.toLowerCase();
    if (knownFriend || searchCache.current.has(key)) {
      setPerson(knownFriend ?? searchCache.current.get(key) ?? null);
      setSearched(true); setSearching(false); setSearchError("");
      return;
    }
    const controller = new AbortController();
    setSearching(true); setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const result = await request<{ person: AccountPerson | null }>("/api/people/search", {
          method: "POST", ...jsonBody({ query: value }), signal: controller.signal,
        });
        if (!controller.signal.aborted && revision.current === current) {
          searchCache.current.set(key, result.person);
          setPerson(result.person); setSearched(true); setActive(-1);
        }
      } catch (error) {
        if (!controller.signal.aborted && revision.current === current) setSearchError((error as Error).message);
      } finally {
        if (!controller.signal.aborted && revision.current === current) setSearching(false);
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [expanded, canSearch, composing, knownFriend, query, value, searchAttempt]);
  const choices: Choice[] = [
    ...availableFriends.map(friend => ({ key: `friend-${friend.id}`, label: friend.name, detail: `@${friend.username}`, run: () => addAccounts([friend]) })),
    ...availableGroups.map(group => ({ key: `group-${group.id}`, label: group.name, detail: t("social.groupPeople", [group.members.filter(member => !selectedAccountIds.includes(member.id)).length]), run: () => addAccounts(group.members) })),
  ];
  if (person && !selectedAccountIds.includes(person.id) && !availableFriends.some(friend => friend.id === person.id))
    choices.push({ key: `account-${person.id}`, label: person.name, detail: `@${person.username}`, run: () => addAccounts([person]) });
  if (value && value.length <= 191 && !accountQuery && !person && (!canSearch || searched))
    choices.push({ key: "manual", label: t("social.addNameOnly", [value]), detail: t("social.nameOnlyHint"), run: () => { if (!disabled && onAddName(value)) reset(); } });
  const selected = active >= 0 && active < choices.length ? active : -1;
  const selectedKey = selected >= 0 ? choices[selected].key : null;
  useEffect(() => {
    if (expanded && selectedKey) document.getElementById(`${listId}-${selectedKey}`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, selectedKey, listId]);
  return <div className="bill-people-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); }
  }}>
    <label className="field" htmlFor={`${listId}-input`}><span>{t("social.addParticipant")}</span></label>
    <div className="people-picker-input">
      <input ref={input} id={`${listId}-input`} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && selected >= 0 ? `${listId}-${choices[selected].key}` : undefined}
        placeholder={t("social.participantPlaceholder")} value={query} disabled={disabled} maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={event => {
          revision.current++; setQuery(event.target.value); setPerson(null); setSearched(false);
          setSearchError(""); setSearching(false); setOpen(true); setActive(-1);
        }} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive(index => choices.length ? event.key === "ArrowDown" ? (index + 1) % choices.length : (index <= 0 ? choices.length : index) - 1 : -1);
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (expanded && selected >= 0) choices[selected].run();
            else if (value) {
              setOpen(true);
              if (person) { if (!selectedAccountIds.includes(person.id)) addAccounts([person]); }
              else if ((!canSearch || searched) && !accountQuery && value.length <= 191 && onAddName(value)) reset();
            }
            else setOpen(true);
          }
        }} />
      <button type="button" className="people-picker-toggle" disabled={disabled} aria-label={t("social.togglePeople")}
        aria-expanded={expanded} onClick={() => { input.current?.focus(); setOpen(!expanded); setActive(-1); }}><Icon name="chevron" size={18} /></button>
    </div>
    {expanded && <div className="people-picker-menu">
      {(friendsLoading || groupsLoading || searching) && <p className="field-hint" role="status">{t(searching ? "social.searching" : "social.loading")}</p>}
      <div id={listId} role="listbox" aria-label={t("social.addParticipant")}>
        {choices.map((choice, index) => <button id={`${listId}-${choice.key}`} key={choice.key} type="button" role="option" aria-selected={selected === index}
          className="people-picker-option" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={choice.run}>
          <span>{choice.label}</span>{choice.detail && <small>{choice.detail}</small>}
        </button>)}
      </div>
      {searched && !person && <p className="field-hint" role="status">{t("social.personNotFound")}</p>}
      {value && accountQuery && !canSearch && allowAccounts && <p className="field-hint" role="status">{t("social.searchInvalid")}</p>}
      {person && selectedAccountIds.includes(person.id) && <p className="field-hint" role="status">{t("social.personAlreadyAdded")}</p>}
      {!value && !friendsLoading && !groupsLoading && !choices.length && <p className="field-hint">{t("social.typeParticipant")}</p>}
      {searchError && <p className="error" role="alert">{feedback(searchError)} <button type="button" className="text-link" onClick={() => setSearchAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
      {friendsError && <p className="error" role="alert">{t("social.friendsUnavailable")} <button type="button" className="text-link" onClick={() => setFriendAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
      {groupsError && <p className="error" role="alert">{t("social.groupsUnavailable")} <button type="button" className="text-link" onClick={() => setGroupAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
      {allowAccounts && <Link className="text-link people-picker-manage" href="/friends">{t("social.manageFriends")}</Link>}
    </div>}
  </div>;
}
