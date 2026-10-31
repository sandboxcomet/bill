"use client";
import { sharedBillPath, manageBillPath } from "@/lib/bill-paths";
import { nameInitial } from "@/lib/name-initial";
import { participantNameKey } from "@/lib/participant-name";
import { useI18n, useLocalizedRouter } from "@/components/LanguageProvider";
import Link from "@/components/LocalizedLink";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Decimal from "decimal.js";
import { calculateBill } from "@/lib/billing";
import { roundBillTotal, type BillRounding } from "@/lib/bill-rounding";
import { createDraftBill } from "@/app/actions/bill";
import { baht, jsonBody, request } from "@/lib/client";
import { Icon } from "./Icons";
import SettlementSummary from "./SettlementSummary";
import ItemPayer from "./ItemPayer";
import { calculatePayerUpfront, calculateSettlements, isPromptPayId } from "@/lib/settlements";
import PinInput from "./PinInput";
import BillPeoplePicker from "./BillPeoplePicker";
import BillItemDesktop from "./BillItemDesktop";
import BillItemMobile from "./BillItemMobile";
import type { BillEditorItem as Item, BillEditorPerson as Person, BillItemProps } from "./bill-item-types";
import type { AccountPerson } from "@/lib/social";
import { isBillPin } from "@/lib/pin";
import styles from "./BillEditor.module.css";
type Draft = {
  name: string;
  restaurants: { id: string; name: string }[];
  participants: Person[];
  payerCandidateIds: string[];
  creatorInitialized?: boolean;
  creatorParticipantId?: string;
  itemPayersEnabled: boolean;
  items: Item[];
  serviceChargeValue: string;
  serviceChargeType: "%" | "฿";
  vatValue: string;
  vatType: "%" | "฿";
  vatIncludesSc: boolean;
  roundingMode: BillRounding;
  isPublic: boolean;
  passcode: string;
};
type AccountPromptPay = { id: string; accountUserId: number; value: string | null };
const uid = () => crypto.randomUUID();
const emptyItem = (): Item => ({
  id: uid(),
  name: "",
  price: "",
  quantity: 1,
  discountRate: "",
  isShared: true,
  includeSC: false,
  includeVat: false,
  consumers: [],
});
const initial: Draft = {
  name: "",
  restaurants: [],
  itemPayersEnabled: true,
  participants: [],
  payerCandidateIds: [],
  items: [],
  serviceChargeValue: "",
  serviceChargeType: "%",
  vatValue: "",
  vatType: "%",
  vatIncludesSc: false,
  roundingMode: "none",
  isPublic: true,
  passcode: "",
};
const dec = (v: string | number) => {
  try {
    const d = new Decimal(v || 0);
    return d.isFinite() && d.gte(0) ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
};
const optionalNumberInput = (value: string | number | null | undefined) =>
  dec(value ?? 0).isZero() ? "" : String(value);
function sample(): Draft {
  const participants = [
    { id: "example-may", name: "เมย์", isPayer: false },
    { id: "example-boss", name: "บอส", isPayer: false },
    { id: "example-nut", name: "นัท", isPayer: false },
  ];
  return {
    ...initial,
    name: "ทริปวันหยุด",
    participants,
    items: [
      { ...emptyItem(), name: "ค่าเดินทาง", price: "480", payerId: "example-may" },
      { ...emptyItem(), name: "ค่าอุปกรณ์", price: "240", payerId: "example-boss" },
    ],
  };
}
export default function BillEditor({
  billId,
  demo = false,
  repeatGroup,
}: {
  billId?: string;
  demo?: boolean;
  repeatGroup?: { sourceId: string; names: string[]; members?: AccountPerson[]; people?: Omit<Person, "id" | "isPayer">[] };
}) {
  const { t, feedback } = useI18n();
  const { data: session, status } = useSession();
  const draftKey = session?.user?.id
    ? `wonglao-bill:new:v1:${session.user.id}${repeatGroup ? `:repeat:${repeatGroup.sourceId}` : ""}`
    : null;
  const recoveryKey = billId && session?.user?.id ? `wonglao-bill:recovery:v1:${session.user.id}:${billId}` : null;
  const creatorName = (
    session?.user?.nickname?.trim() ||
    session?.user?.name?.trim() ||
    t("bill.creator")
  ).slice(0, 191);
  const router = useLocalizedRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [accountPromptPays, setAccountPromptPays] = useState<AccountPromptPay[]>([]);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [restaurantName, setRestaurantName] = useState("");
  const [editingPerson, setEditingPerson] = useState<{ id: string; name: string } | null>(null);
  const [personEditDirty, setPersonEditDirty] = useState(false);
  const personEditRevision = useRef(0);
  const [personalAliases, setPersonalAliases] = useState<AccountPerson[]>([]);
  const [aliasesLoaded, setAliasesLoaded] = useState(false);
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState("");
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [compactItems, setCompactItems] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => { setCompactItems(media.matches); if (!media.matches) setEditingItemId(null); };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const [scrollPosition, setScrollPosition] = useState({ canGoUp: false, canGoDown: false });
  useEffect(() => {
    if (!loaded) return;
    const refresh = () => {
      const bottom = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      setScrollPosition({ canGoUp: window.scrollY > 2, canGoDown: window.scrollY < bottom - 2 });
    };
    refresh();
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(document.documentElement);
    return () => { window.removeEventListener("scroll", refresh); window.removeEventListener("resize", refresh); observer.disconnect(); };
  }, [loaded]);
  useEffect(() => {
    if (demo || status !== "authenticated") return;
    let active = true;
    request<{ aliases: AccountPerson[] }>("/api/people/aliases").then(result => {
      if (active) { setPersonalAliases(result.aliases); setAliasesLoaded(true); }
    }).catch(() => { if (active) setError(t("editor.aliasLoadFailed")); });
    return () => { active = false; };
  }, [demo, status, t]);
  useEffect(() => {
    if (!loaded || !aliasesLoaded) return;
    setDraft(current => ({ ...current, participants: current.participants.map(person => {
      const alias = personalAliases.find(a => a.id === (person.canonicalAccountUserId ?? person.accountUserId));
      if (!alias) return person.accountUserId && person.accountName ? { ...person, name: person.accountName, ownerAlias: null } : person;
      return { ...person, accountName: person.accountName ?? person.name, ownerAlias: alias.ownerAlias, name: alias.ownerAlias || person.name };
    }) }));
  }, [loaded, personalAliases, aliasesLoaded]);
  useEffect(() => {
    if (!loaded || demo || status !== "authenticated") return;
    let active = true;
    request<{ friends: { person: AccountPerson }[] }>("/api/friends").then(({ friends }) => {
      if (!active) return;
      const profiles = new Map(friends.map(({ person }) => [person.id, person]));
      setDraft(current => ({ ...current, participants: current.participants.map(person => {
        const profile = profiles.get(person.canonicalAccountUserId ?? person.accountUserId ?? 0);
        const image = profile ? profile.image : person.accountUserId === Number(session?.user?.id) ? session?.user?.image || (session?.user?.loginProvider === "google" ? "/google-avatar.svg" : null) : person.image;
        return image === person.image ? person : { ...person, image };
      }) }));
    }).catch(() => {});
    return () => { active = false; };
  }, [loaded, demo, status, session?.user?.id, session?.user?.image, session?.user?.loginProvider]);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(billId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharingError, setSharingError] = useState("");
  const [promptPay, setPromptPay] = useState("");
  const [profilePromptPay, setProfilePromptPay] = useState<{ userId: string; value: string } | null>(null);
  const [billStatus, setBillStatus] = useState("DRAFT");
  const [locked, setLocked] = useState(false);
  const [savedDirty, setSavedDirty] = useState(false);
  const [recoveryConflict, setRecoveryConflict] = useState(false);
  const version = useRef(0);
  const idRef = useRef(billId);
  const saveGuard = useRef(false);
  const immediateSave = useRef(false);
  const dirty = useRef(false);
  const editRevision = useRef(0);
  const pendingPersonEdit = useRef(false);
  pendingPersonEdit.current = personEditDirty || aliasSaving;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demo) {
      setDraft(sample());
      setLoaded(true);
      return;
    }
    if (
      billId ||
      !draftKey ||
      status !== "authenticated" ||
      loadedDraftKey === draftKey
    )
      return;
    const creator = (): Person => ({
      id: uid(),
      name: creatorName,
      isPayer: false,
      image: session?.user?.image || (session?.user?.loginProvider === "google" ? "/google-avatar.svg" : null),
      accountUserId: Number(session?.user?.id),
      username: session?.user?.username ?? undefined,
    });
    const freshDraft = (): Draft => {
      const people: Person[] = repeatGroup?.people?.map(p => ({ ...p, id: uid(), isPayer: false })) ?? repeatGroup?.members?.map(p => ({ id: uid(), name: p.name, isPayer: false, accountUserId: p.id, image: p.image, username: p.username, hasPromptPay: p.hasPromptPay }))
        ?? repeatGroup?.names.map(name => ({ id: uid(), name, isPayer: false })) ?? [];
      let person = people.find(p => p.accountUserId === Number(session?.user?.id)) ?? people.find(p => !p.accountUserId && p.name === creatorName);
      if (person) { person.accountUserId = Number(session?.user?.id); person.username = session?.user?.username ?? undefined; }
      if (!person && people.length < 100) { person = creator(); people.unshift(person); }
      return { ...initial, participants: people, creatorParticipantId: person?.id,
        creatorInitialized: true, items: [{ ...emptyItem(), payerId: person?.id }] };
    };
    try {
      const stored = localStorage.getItem(draftKey);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && !parsed.synced && Array.isArray(parsed.items) && Array.isArray(parsed.participants)) {
        if (parsed.serverBillId) idRef.current = parsed.serverBillId;
        version.current = parsed.serverVersion ?? 0;
        dirty.current = true;
        editRevision.current++;
        setSavedDirty(true);
      }
      const restored: Draft =
        parsed && !parsed.synced &&
        Array.isArray(parsed.items) &&
        Array.isArray(parsed.participants)
          ? {
              ...parsed,
              payerCandidateIds: Array.isArray(parsed.payerCandidateIds) ? parsed.payerCandidateIds : [],
              roundingMode: parsed.roundingMode ?? "none",
              restaurants: Array.isArray(parsed.restaurants) ? parsed.restaurants : [],
              itemPayersEnabled: parsed.itemPayersEnabled === true,
              serviceChargeValue: optionalNumberInput(parsed.serviceChargeValue),
              vatValue: optionalNumberInput(parsed.vatValue),
              items: parsed.items.length
                ? parsed.items.map((item: Item) => ({
                    ...item,
                    discountRate: optionalNumberInput(item.discountRate),
                  }))
                : [emptyItem()],
            }
          : freshDraft();
      if (!restored.creatorInitialized) {
        const creatorNames = new Set([
          creatorName,
          session?.user?.name?.trim(),
        ]);
        if (
          restored.participants.length < 100 &&
          !restored.participants.some((p) => creatorNames.has(p.name.trim()))
        ) {
          restored.participants = [creator(), ...restored.participants];
        }
        restored.creatorInitialized = true;
      }
      if (restored.creatorParticipantId) restored.participants = restored.participants.map(p =>
        p.id === restored.creatorParticipantId ? { ...p, accountUserId: Number(session?.user?.id), username: session?.user?.username ?? undefined } : p);
      setDraft(restored);
    } catch {
      setDraft(freshDraft());
    }
    setLoadedDraftKey(draftKey);
    setLoaded(true);
  }, [
    billId,
    demo,
    draftKey,
    status,
    creatorName,
    session?.user?.name,
    session?.user?.id,
    session?.user?.username,
    loadedDraftKey,
    repeatGroup,
  ]);
  useEffect(() => {
    if (!billId || status === "loading") return;
    if (status === "unauthenticated") {
      router.replace(
        `/login?callbackUrl=${encodeURIComponent(manageBillPath(billId))}`,
      );
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request<any>(`/api/bills/${billId}`)
      .then(({ bill }) => {
        if (!active) return;
        setAccountPromptPays(bill.participants.filter((p: Person) => p.accountUserId != null).map((p: Person & { accountPromptPayId?: string | null }) => ({ id: p.id, accountUserId: p.accountUserId!, value: p.accountPromptPayId ?? null })));
        version.current = bill.version;
        setBillStatus(bill.status);
        if (bill.status === "CANCELLED") {
          router.replace(sharedBillPath(billId));
          return;
        }
        const isLocked = bill.hasPaymentEvidence || bill.participants.some(
          (p: any) => p.isPaid || Number(p.paidAmount) > 0,
        );
        setLocked(isLocked);
        const serverDraft: Draft = {
          name: bill.name,
          restaurants: Array.isArray(bill.restaurants) ? bill.restaurants : [],
          itemPayersEnabled: bill.itemPayersEnabled,
          participants: bill.participants.map(({ accountPromptPayId: _accountPromptPayId, ...p }: Person & { accountPromptPayId?: string | null }) => ({ ...p, accountName: p.accountUserId ? p.name : undefined, name: p.ownerAlias || p.name })),
          payerCandidateIds: Array.isArray(bill.payerCandidateIds) ? bill.payerCandidateIds : [],
          items: bill.items.map((i: any) => ({
            ...i,
            id: i.id,
            price: String(i.price),
            discountRate: optionalNumberInput(i.discountRate),
            includeSC: i.includeSc,
            consumers: i.consumers.map((p: any) => p.id),
            consumerQuantities: i.consumerQuantities ?? undefined,
          })),
          serviceChargeValue: optionalNumberInput(
            bill.serviceChargeValue ?? bill.serviceCharge,
          ),
          serviceChargeType: bill.serviceChargeType ?? "฿",
          vatValue: optionalNumberInput(bill.vatValue ?? bill.vat),
          vatType: bill.vatType ?? "฿",
          vatIncludesSc: bill.vatIncludesSc ?? false,
          roundingMode: bill.roundingMode ?? "none",
          isPublic: bill.isPublic,
          passcode: bill.passcode ?? "",
        };
        let recovered: { draft: Draft; version: number; synced: boolean } | null = null;
        try {
          const stored = recoveryKey ? sessionStorage.getItem(recoveryKey) : null;
          recovered = stored ? JSON.parse(stored) : null;
        } catch { setNotice(t("errors.draftStorageUnavailable")); }
        if (recovered && !recovered.synced && recovered.draft && Array.isArray(recovered.draft.items) && Array.isArray(recovered.draft.participants) && Number.isInteger(recovered.version)) {
          const conflict = recovered.version !== bill.version || isLocked;
          version.current = recovered.version;
          dirty.current = true;
          editRevision.current++;
          setSavedDirty(true);
          setRecoveryConflict(conflict);
          setDraft({ ...recovered.draft, payerCandidateIds: Array.isArray(recovered.draft.payerCandidateIds) ? recovered.draft.payerCandidateIds : [] });
        } else {
          setRecoveryConflict(false);
          setDraft(serverDraft);
        }
        setLoaded(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [billId, status, router, attempt, recoveryKey]);
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    let active = true;
    const userId = session.user.id;
    setPromptPay("");
    request<any>("/api/profile")
      .then((d) => {
        if (!active) return;
        const value = d.user?.promptPayId ?? "";
        setPromptPay(value);
        setProfilePromptPay({ userId, value });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [status, session?.user?.id]);
  useEffect(() => {
    if (!profilePromptPay?.value || profilePromptPay.userId !== session?.user?.id ||
      !draft.creatorParticipantId || loadedDraftKey !== draftKey || demo) return;
    setDraft((current) => ({ ...current, participants: current.participants.map((p) =>
      p.id === current.creatorParticipantId && p.promptPayId === undefined ? { ...p, promptPayId: profilePromptPay.value } : p) }));
  }, [profilePromptPay, session?.user?.id, draft.creatorParticipantId, loadedDraftKey, draftKey, demo]);
  useEffect(() => {
    if (
      !loaded ||
      billId ||
      demo ||
      !draftKey ||
      loadedDraftKey !== draftKey ||
      status !== "authenticated"
    )
      return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ ...draft, serverBillId: idRef.current, serverVersion: version.current, synced: !dirty.current }));
    } catch {
      setNotice(
        t("errors.draftStorageUnavailable"),
      );
    }
  }, [draft, loaded, billId, demo, draftKey, loadedDraftKey, status]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || pendingPersonEdit.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function persistRecovery(value: Draft, synced = false) {
    try {
      if (recoveryKey) sessionStorage.setItem(recoveryKey, JSON.stringify({ draft: value, version: version.current, synced }));
      else if (!billId && draftKey && !demo) localStorage.setItem(draftKey, JSON.stringify({ ...value, serverBillId: idRef.current, serverVersion: version.current, synced }));
    } catch { setNotice(t("errors.draftStorageUnavailable")); }
  }
  function update(data: Partial<Draft>, immediate = true) {
    dirty.current = true;
    editRevision.current++;
    if (immediate) immediateSave.current = true;
    setSavedDirty(true);
    setAutoSaveError("");
    setNotice("");
    const next = { ...latestDraft.current, ...data };
    latestDraft.current = next;
    persistRecovery(next);
    setDraft(next);
  }
  function updateItem(id: string, changes: Partial<Item>, immediate = true) {
    update({
      items: draft.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    }, immediate);
  }
  function allParticipantsSelected(item: Item) {
    return (
      draft.participants.length > 0 &&
      (item.isShared || draft.participants.every((p) => item.consumers.includes(p.id)))
    );
  }
  function toggleParticipant(item: Item, participantId: string) {
    const selected = item.isShared
      ? draft.participants.map((p) => p.id)
      : item.consumers;
    const consumers = selected.includes(participantId)
      ? selected.filter((id) => id !== participantId)
      : [...selected, participantId];
    const isShared =
      draft.participants.length > 0 &&
      draft.participants.every((p) => consumers.includes(p.id));
    updateItem(item.id, {
      isShared,
      consumers: isShared ? [] : consumers,
      consumerQuantities: undefined,
    });
  }
  function updateParticipantParts(
    item: Item,
    participantId: string,
    value: string,
  ) {
    if (!/^\d{0,3}$/.test(value)) return;
    const quantities = {
      ...item.consumerQuantities,
      [participantId]: Number(value),
    };
    updateItem(item.id, {
      isShared: false,
      consumerQuantities: quantities,
      consumers: Object.entries(quantities)
        .filter(([, parts]) => parts > 0)
        .map(([id]) => id),
    }, false);
  }
  const calcItems = draft.items.map((i) => ({
    ...i,
    price: dec(i.price),
    discountRate: Decimal.min(dec(i.discountRate), 100),
    quantity: Number.isInteger(i.quantity) ? Math.max(1, i.quantity) : 1,
  }));
  const net = (i: (typeof calcItems)[number]) =>
    i.price.mul(i.quantity).mul(new Decimal(1).minus(i.discountRate.div(100)));
  const subtotal = calcItems
    .reduce((s, i) => s.plus(net(i)), new Decimal(0))
    .toDecimalPlaces(2);
  const restaurantTotals = (() => {
    if (draft.restaurants.length < 2) return [];
    const ids = new Set(draft.restaurants.map(restaurant => restaurant.id));
    const groups = draft.restaurants.map(restaurant => ({
      id: restaurant.id, name: restaurant.name,
      amount: calcItems.filter(item => item.restaurantId === restaurant.id).reduce((sum, item) => sum.plus(net(item)), new Decimal(0)),
    }));
    const unassigned = calcItems.filter(item => !item.restaurantId || !ids.has(item.restaurantId));
    if (unassigned.length) groups.push({ id: "", name: t("editor.noRestaurant"), amount: unassigned.reduce((sum, item) => sum.plus(net(item)), new Decimal(0)) });
    let cumulative = new Decimal(0);
    let rounded = new Decimal(0);
    return groups.map(group => {
      cumulative = cumulative.plus(group.amount);
      const next = cumulative.toDecimalPlaces(2);
      const amount = next.minus(rounded);
      rounded = next;
      return { ...group, amount };
    });
  })();
  const scBase = calcItems
    .filter((i) => i.includeSC)
    .reduce((s, i) => s.plus(net(i)), new Decimal(0));
  const sc = (
    draft.serviceChargeType === "%"
      ? scBase.mul(dec(draft.serviceChargeValue)).div(100)
      : dec(draft.serviceChargeValue)
  ).toDecimalPlaces(2);
  const vatBase = calcItems
    .filter((i) => i.includeVat)
    .reduce((s, i) => s.plus(net(i)), new Decimal(0))
    .plus(draft.vatIncludesSc ? sc : 0);
  const vat = (
    draft.vatType === "%"
      ? vatBase.mul(dec(draft.vatValue)).div(100)
      : dec(draft.vatValue)
  ).toDecimalPlaces(2);
  const unroundedTotal = subtotal.plus(sc).plus(vat);
  const total = roundBillTotal(unroundedTotal, draft.roundingMode);
  const roundingAdjustment = total.minus(unroundedTotal);
  const result = calculateBill({
    items: calcItems,
    participants: draft.participants.map((p) => ({
      ...p,
      totalPayable: new Decimal(0),
    })),
    serviceCharge: sc,
    vat,
    grandTotal: total,
  });
  const settlement = draft.itemPayersEnabled ? calculateSettlements({
    items: calcItems, participants: draft.participants.map((p) => ({ ...p, totalPayable: new Decimal(0) })),
    serviceCharge: sc, vat, grandTotal: total,
  }) : null;
  const upfrontTotals = calculatePayerUpfront({ items: calcItems,
    participants: draft.participants.map(p => ({ ...p, totalPayable: new Decimal(0) })),
    serviceCharge: sc, vat, grandTotal: total });
  const hasMissingPayer = draft.itemPayersEnabled && draft.items.some((i) => !draft.participants.some((p) => p.id === i.payerId));
  const missingPayerCount = draft.itemPayersEnabled ? draft.items.filter(item => !draft.participants.some(person => person.id === item.payerId)).length : 0;
  const unassignedUpfront = total.minus(upfrontTotals.reduce((sum, person) => sum.plus(person.paidUpfront), new Decimal(0)));
  const selectedPayers = draft.participants.filter(p => draft.items.some(item => item.payerId === p.id));
  const payerCandidates = draft.payerCandidateIds.length
    ? draft.participants.filter(p => draft.payerCandidateIds.includes(p.id))
    : draft.participants;
  const hasUnassigned = draft.items.some(
    (i) =>
      !i.isShared &&
      !(i.consumerQuantities
        ? Object.values(i.consumerQuantities).some((q) => q > 0)
        : i.consumers.length),
  );
  const editingTarget = editingPerson ? draft.participants.find(p => p.id === editingPerson.id) : undefined;
  const addPerson = (value: string) => {
    const name = value.trim();
    if (!name) return false;
    if (latestDraft.current.participants.some(person => participantNameKey(person.name) === participantNameKey(name))) {
      setError(t("social.nameAlreadyAdded"));
      return false;
    }
    if (draft.participants.length >= 100) {
      setError(t("errors.participantLimit"));
      return false;
    }
    update({
      participants: [
        ...draft.participants,
        { id: uid(), name, isPayer: false },
      ],
    });
    return true;
  };
  function addAccounts(people: AccountPerson[]) {
    people = people.map(person => ({ ...person, ownerAlias: personalAliases.find(alias => alias.id === person.id)?.ownerAlias ?? person.ownerAlias }));
    const additions = [...new Map(people.map(p => [p.id, p])).values()].filter(p => !draft.participants.some(existing => (existing.canonicalAccountUserId ?? existing.accountUserId) === p.id));
    if (draft.participants.length + additions.length > 100) { setError(t("errors.participantLimit")); return false; }
    update({ participants: [...draft.participants.map(existing => {
      const account = people.find(p => p.id === (existing.canonicalAccountUserId ?? existing.accountUserId));
      return account ? { ...existing, accountName: account.name, ownerAlias: account.ownerAlias ?? existing.ownerAlias, name: account.ownerAlias || existing.ownerAlias || account.name, image: account.image, username: account.username, hasPromptPay: account.hasPromptPay } : existing;
    }), ...additions.map(p => ({ id: uid(), name: p.ownerAlias || p.name, isPayer: false,
      accountUserId: p.id, accountName: p.name, ownerAlias: p.ownerAlias, image: p.image, username: p.username, hasPromptPay: p.hasPromptPay }))] });
    return true;
  }
  const canAddSelf = !demo && status === "authenticated" && Boolean(session?.user?.username) &&
    !draft.participants.some(p => (p.canonicalAccountUserId ?? p.accountUserId) === Number(session?.user?.id));
  function addSelf() {
    if (!canAddSelf || locked || saving || !session?.user?.username) return;
    addAccounts([{
      id: Number(session.user.id),
      name: creatorName,
      username: session.user.username,
      image: session.user.image || (session.user.loginProvider === "google" ? "/google-avatar.svg" : null),
      hasPromptPay: profilePromptPay?.userId === session.user.id && Boolean(profilePromptPay.value),
    }]);
  }
  function removePerson(id: string) {
    update({
      participants: draft.participants.filter((p) => p.id !== id),
      payerCandidateIds: draft.payerCandidateIds.filter(candidate => candidate !== id),
      items: draft.items.map((i) => ({
        ...i,
        payerId: i.payerId === id ? null : i.payerId,
        consumers: i.consumers.filter((c) => c !== id),
        consumerQuantities: i.consumerQuantities
          ? Object.fromEntries(
              Object.entries(i.consumerQuantities).filter(([p]) => p !== id),
            )
          : undefined,
      })),
    });
  }
  function togglePayerCandidate(id: string) {
    update({ payerCandidateIds: draft.payerCandidateIds.includes(id)
      ? draft.payerCandidateIds.filter(candidate => candidate !== id)
      : [...draft.payerCandidateIds, id] });
  }
  async function savePersonName(close = false) {
    if (!editingPerson || aliasSaving) return;
    const person = latestDraft.current.participants.find(p => p.id === editingPerson.id);
    const name = editingPerson.name.trim();
    if (!person || (!person.accountUserId && !name)) return;
    const revision = personEditRevision.current;
    setAliasSaving(true);
    try {
      if (person.accountUserId && !demo) {
        const targetId = person.canonicalAccountUserId ?? person.accountUserId;
        await request("/api/people/aliases", { method: "PUT", ...jsonBody({ targetId, name }) });
        setPersonalAliases(previous => [...previous.filter(a => a.id !== targetId), ...(name ? [{ id: targetId, name: person.accountName ?? person.name, username: person.username ?? "", image: person.image ?? null, hasPromptPay: !!person.hasPromptPay, ownerAlias: name }] : [])]);
      }
      if (person.accountUserId) {
        setDraft(current => ({ ...current, participants: current.participants.map(p => p.id !== person.id ? p :
          { ...p, accountName: p.accountName ?? p.name, ownerAlias: name || null, name: name || p.accountName || p.name }) }));
      } else {
        update({ participants: latestDraft.current.participants.map(p => p.id === person.id ? { ...p, name } : p) });
      }
      if (personEditRevision.current === revision) {
        setPersonEditDirty(false);
        if (close) setEditingPerson(null);
      }
      setAliasError("");
    } catch (e) { setAliasError((e as Error).message); }
    finally { setAliasSaving(false); }
  }
  async function save(publish = false, automatic = false) {
    if (saveGuard.current || demo) return;
    setError("");
    setNotice("");
    if (editingPerson && (personEditDirty || aliasSaving)) {
      setError(t("editor.finishEditingPerson"));
      return;
    }
    if (!loaded) {
      setError(t("errors.billNotLoaded"));
      return;
    }
    if (!draft.name.trim() && (publish || billStatus !== "DRAFT")) {
      setError(t("errors.billNameRequired"));
      return;
    }
    if (!draft.isPublic && !isBillPin(draft.passcode)) {
      setError(t("editor.setAFourDigitPIN"));
      return;
    }
    if (
      publish &&
      (!draft.participants.length ||
        !draft.items.length ||
        total.lte(0) ||
        draft.items.some((i) => !i.name.trim() || !i.price) ||
        hasUnassigned)
    ) {
      setError(t("errors.itemsAndParticipantsRequired"));
      return;
    }
    if (
      draft.items.some(
        (i) =>
          !/^\d+(\.\d{1,2})?$/.test(i.price || "0") ||
          !Number.isInteger(i.quantity) ||
          i.quantity < 1 ||
          i.quantity > 999 ||
          dec(i.discountRate).gt(100),
      )
    ) {
      setError(
        t("errors.itemValuesInvalid"),
      );
      return;
    }
    if (publish && hasMissingPayer) {
      setError(t("errors.payersRequired"));
      return;
    }
    if (draft.itemPayersEnabled) {
      const invalid = draft.participants.find((p) => p.promptPayId && !isPromptPayId(p.promptPayId));
      const missing = publish ? settlement?.participants.find((p) => p.amountToReceive.gt(0) && !draft.participants.find((person) => person.id === p.id)?.promptPayId && !draft.participants.find((person) => person.id === p.id)?.accountUserId) : undefined;
      if (invalid || missing) {
        setError(t("errors.personPromptPayInvalid", [(invalid || missing)!.name]));
        return;
      }
    }
    if (!draft.itemPayersEnabled && (publish || promptPay) && !isPromptPayId(promptPay)) {
      setError(t("errors.promptPayInvalid"));
      return;
    }
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent("/new")}`);
      return;
    }
    saveGuard.current = true;
    const revision = editRevision.current;
    if (automatic) setAutoSaving(true); else setSaving(true);
    try {
      const id = idRef.current ?? (await createDraftBill());
      idRef.current = id;
      if (!billId && draftKey) {
        try { localStorage.setItem(draftKey, JSON.stringify({ ...latestDraft.current, serverBillId: id, serverVersion: version.current, synced: false })); } catch {}
      }
      if (!draft.itemPayersEnabled && promptPay)
        await request("/api/profile", {
          method: "PATCH",
          ...jsonBody({ promptPayId: promptPay }),
        });
      const payload = {
        ...draft,
        version: version.current,
        status: publish ? "PUBLISHED" : billStatus,
        isPublic: draft.isPublic,
        passcode: draft.isPublic ? null : draft.passcode,
        serviceChargeValue: dec(draft.serviceChargeValue).toFixed(2),
        vatValue: dec(draft.vatValue).toFixed(2),
        serviceCharge: sc.toFixed(2),
        vat: vat.toFixed(2),
        items: calcItems.map((i) => ({
          ...i,
          price: i.price.toFixed(2),
          discountRate: i.discountRate.toString(),
        })),
      };
      const saved = await request<{ version: number; accountPromptPays: AccountPromptPay[] }>(`/api/bills/${id}`, {
        method: "PATCH",
        ...jsonBody(
          locked
            ? {
                version: version.current,
                status: publish ? "PUBLISHED" : billStatus,
                name: draft.name,
                isPublic: draft.isPublic,
                passcode: draft.isPublic ? null : draft.passcode,
              }
            : payload,
        ),
      });
      version.current = saved.version;
      setAccountPromptPays(saved.accountPromptPays);
      const unchanged = editRevision.current === revision;
      dirty.current = !unchanged;
      setSavedDirty(!unchanged);
      if (billId) persistRecovery(latestDraft.current, unchanged);
      if (!billId && draftKey)
        try {
          localStorage.setItem(
            draftKey,
            JSON.stringify({ ...latestDraft.current, serverBillId: id, serverVersion: saved.version, synced: unchanged }),
          );
        } catch {}
      if (publish) {
        router.push(sharedBillPath(id));
      } else if (unchanged) {
        if (!automatic) setNotice(t("editor.draftSaved"));
        if (!billId) {
          setSaving(true);
          router.replace(manageBillPath(id));
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t("errors.saveFailed");
      if (automatic) setAutoSaveError(message); else setError(message);
    } finally {
      saveGuard.current = false;
      if (automatic) setAutoSaving(false); else setSaving(false);
    }
  }
  async function stopSharing() {
    if (saveGuard.current || !idRef.current || billStatus !== "PUBLISHED") return;
    saveGuard.current = true;
    setSaving(true); setSharingError(""); setNotice("");
    try {
      const saved = await request<{ version: number; status: string }>(`/api/bills/${idRef.current}`, {
        method: "PATCH", ...jsonBody({ version: version.current, status: "UNSHARED" }),
      });
      version.current = saved.version;
      setBillStatus(saved.status);
    } catch (error) { setSharingError((error as Error).message); }
    finally { setSaving(false); saveGuard.current = false; }
  }
  const autoSaveReady = loaded && status === "authenticated" && !demo && savedDirty && !saving && !autoSaving && !autoSaveError && !personEditDirty && !aliasSaving && !recoveryConflict &&
    (billStatus === "DRAFT" || Boolean(draft.name.trim())) &&
    (draft.isPublic || isBillPin(draft.passcode)) &&
    draft.items.every(i => /^\d+(\.\d{1,2})?$/.test(i.price || "0") && Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 999 && dec(i.discountRate).lte(100)) &&
    draft.participants.every(p => !p.promptPayId || isPromptPayId(p.promptPayId)) &&
    (draft.itemPayersEnabled || !promptPay || isPromptPayId(promptPay)) &&
    (billStatus !== "PUBLISHED" || locked || (draft.participants.length > 0 && draft.items.length > 0 && total.gt(0) && !hasUnassigned && !hasMissingPayer && draft.items.every(i => i.name.trim() && i.price)));
  useEffect(() => {
    if (!autoSaveReady) return;
    const timer = setTimeout(() => { immediateSave.current = false; void save(false, true); }, immediateSave.current ? 0 : 1000);
    return () => clearTimeout(timer);
  }, [draft, promptPay, autoSaveReady]);
  useEffect(() => {
    if (!editingPerson || !personEditDirty || aliasSaving || aliasError || (!editingTarget?.accountUserId && !editingPerson.name.trim())) return;
    const timer = setTimeout(() => { void savePersonName(); }, 1000);
    return () => clearTimeout(timer);
  }, [editingPerson, personEditDirty, aliasSaving, aliasError]);
  if (loading || !loaded)
    return (
      <div id="content" className="empty-state">
        <span className="spinner" />
        {error ? (
          <>
            <p className="error" role="alert">
              {feedback(error)}
            </p>
            <button
              className="button secondary"
              onClick={() => setAttempt((v) => v + 1)}
            > {t("common.reload")} </button>
          </>
        ) : (
          <p>{t("common.openingBill")}</p>
        )}
      </div>
    );
  return (
    <div id="content">
      <div className="editor-top">
        <Link
          className="text-link muted"
          href="/bills"
          onClick={(e) => {
            if (
              (dirty.current || pendingPersonEdit.current) &&
              !window.confirm(
                t("editor.leaveConfirmation"),
              )
            )
              e.preventDefault();
          }}
        >
          <Icon name="back" size={17} /> {t("nav.myBills")} </Link>
        <span className="save-indicator">
          <span className="live-dot" />
          {demo
            ? t("editor.sampleBillTryEditing")
            : autoSaving ? t("editor.autoSaving")
              : autoSaveError ? t("editor.autoSaveFailed")
              : savedDirty ? t("editor.autoSavePending")
              : t("editor.autoSaved")}
        </span>
      </div>
      {recoveryConflict && <p className="warning" role="alert">{t("editor.recoveryConflict")}</p>}
      <div className="page-heading bill-editor-heading">
        <div>
          <h1>
            {demo
              ? t("common.tryASampleBill")
              : billId
                ? t("editor.manageBill")
                : t("bill.create")}
          </h1>
          <p>{t("editor.intro")}</p>
        </div>
        <div className="editor-share-actions">
          <span className={`status status-${billStatus.toLowerCase()}`}>
            {t(billStatus === "PUBLISHED" ? "bill.status.published" : billStatus === "UNSHARED" ? "bill.status.unshared" : "bill.status.draft")}
          </span>
          {!demo && billId && billStatus === "PUBLISHED" && <button type="button" className="button secondary" disabled={saving || autoSaving || savedDirty || personEditDirty || aliasSaving} onClick={stopSharing}>
            {t("editor.stopSharing")}
          </button>}
        </div>
      </div>
      {sharingError && <p className="error" role="alert">{feedback(sharingError)}</p>}
      {billStatus === "UNSHARED" && <div className="notice" role="status">{t("editor.sharingStoppedHint")}</div>}
      {demo && (
        <div className="notice"> {t("editor.demoNotice")}{" "}
          <Link href="/new"> {t("editor.createYourOwnBill")} <Icon name="arrow" size={15} />
          </Link>
        </div>
      )}
      {locked && (
        <div className="notice"> {t("editor.paidBillLocked")} </div>
      )}
      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel">
            <div className="panel-heading">
              <h2>{t("editor.whatIsThisBillFor")}</h2>
              <Icon name="receipt" />
            </div>
            <label className="field">
              <span>{t("bill.name")}</span>
              <input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value }, false)}
                maxLength={191}
                placeholder={t("editor.billNamePlaceholder")}
              />
            </label>
            <div className="restaurant-options">
              {draft.restaurants.length > 0 && <fieldset disabled={locked || saving}>
                <legend className={styles.restaurantLegend}>{t("editor.restaurants")}</legend>
                <div className="people-list">
                {draft.restaurants.map(restaurant => <span className="person-chip" key={restaurant.id}>
                  {restaurant.name}
                  <button type="button" className="chip-remove" aria-label={t("editor.removeRestaurant", [restaurant.name])}
                    onClick={() => update({ restaurants: draft.restaurants.filter(r => r.id !== restaurant.id), items: draft.items.map(item => item.restaurantId === restaurant.id ? { ...item, restaurantId: null } : item) })}>
                    <Icon name="close" size={13} />
                  </button>
                </span>)}
                </div>
              </fieldset>}
              <details>
                <summary>{draft.restaurants.length ? t("editor.manageRestaurants") : t("editor.addRestaurantOptional")}</summary>
                <p className="field-hint">{t("editor.restaurantsHint")}</p>
                <fieldset disabled={locked || saving} className="restaurant-add">
                <label className="field"><span>{t("editor.restaurantName")}</span><input value={restaurantName} maxLength={191} onChange={e => setRestaurantName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (restaurantName.trim() && draft.restaurants.length < 100) { update({ restaurants: [...draft.restaurants, { id: uid(), name: restaurantName.trim() }] }); setRestaurantName(""); } } }} /></label>
                <button type="button" className="button secondary" disabled={!restaurantName.trim() || draft.restaurants.length >= 100} onClick={() => { update({ restaurants: [...draft.restaurants, { id: uid(), name: restaurantName.trim() }] }); setRestaurantName(""); }}><Icon name="plus" size={18} /> {t("editor.addRestaurant")}</button>
                </fieldset>
              </details>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2> {t("editor.whoIsSharingThisBill")}{" "}
                <span className="inline-count">
                  {draft.participants.length}
                </span>
              </h2>
              <Icon name="users" />
            </div>
            <fieldset disabled={locked || saving}>
              <div className="people-list">
                {draft.participants.map((p, index) => (
                  <span className={`person-chip ${styles.personChip}${editingPerson?.id === p.id ? " person-chip-editing" : ""}`} key={p.id}>
                    <span className={styles.personAvatar}>
                      <span className={`avatar small social-avatar tone-${index % 4}`} aria-hidden="true">
                        {nameInitial(p.name)}
                        {p.accountUserId && p.image && <img key={p.image} src={p.image} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.hidden = true; }} />}
                      </span>
                    </span>
                    <button type="button" className="person-edit" disabled={Boolean(editingPerson)} aria-label={t("editor.editPerson", [p.name])}
                      title={t("editor.editPerson", [p.name])} onClick={() => { setAliasError(""); setPersonEditDirty(false); setEditingPerson({ id: p.id, name: p.accountUserId ? p.ownerAlias ?? "" : p.name }); }}>{p.name}</button>
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={t("editor.removePerson", [p.name])}
                      onClick={() => { if (editingPerson?.id === p.id) setEditingPerson(null); removePerson(p.id); }}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                ))}
              </div>
              {draft.participants.length > 0 && !editingPerson && <p className="field-hint person-edit-hint">{t("editor.tapNameToEdit")}</p>}
              {editingPerson && editingTarget && <div className="person-name-editor">
                <label className="field"><span>{t("editor.editPerson", [editingTarget.accountName || editingTarget.name])}{editingTarget.username && <small> @{editingTarget.username}</small>}</span>
                  <input autoFocus maxLength={191} value={editingPerson.name} placeholder={editingTarget.accountUserId ? editingTarget.accountName || editingTarget.name : undefined} onChange={e => { personEditRevision.current++; setPersonEditDirty(true); setAliasError(""); setEditingPerson({ ...editingPerson, name: e.target.value }); }}
                    onKeyDown={e => { if (e.key === "Escape" && !aliasSaving) { e.preventDefault(); if (personEditDirty) void savePersonName(true); else setEditingPerson(null); } }} />
                </label>
                {editingTarget.accountUserId && <p className="field-hint">{t("editor.accountAliasHint")}</p>}
                {aliasError && <p className="error" role="alert">{feedback(aliasError)}</p>}
                <div className="person-name-actions">
                  <button type="button" className="button primary button-small" disabled={aliasSaving || (!editingPerson.name.trim() && !editingTarget.accountUserId)} onClick={() => { if (personEditDirty) void savePersonName(true); else setEditingPerson(null); }}>{t("common.done")}</button>
                  {aliasSaving && <span className="field-hint" role="status">{t("editor.autoSaving")}</span>}
                  {aliasError && <button type="button" className="text-link" onClick={() => setAliasError("")}>{t("common.retry")}</button>}
                </div>
              </div>}
              {canAddSelf && <button type="button" className="button secondary button-small" onClick={addSelf}>
                <Icon name="plus" size={17} /> {t("editor.addMyself")}
              </button>}
              <BillPeoplePicker onAdd={addAccounts} onAddName={addPerson} disabled={locked || saving} allowAccounts={!demo} aliases={personalAliases}
                selectedNames={draft.participants.map(person => person.name)}
                selectedAccountIds={draft.participants.flatMap(person => {
                  const id = person.canonicalAccountUserId ?? person.accountUserId;
                  return id == null ? [] : [id];
                })} />
              {!draft.participants.length && (
                <p className="field-hint"> {t("editor.participantsEmpty")} </p>
              )}
              {draft.itemPayersEnabled && <div className={styles.payerCandidates}>
                <h3>{t("editor.whoCanPay")}</h3>
                <p className="field-hint">{t("editor.whoCanPayHint")}</p>
                <div className={styles.payerCandidateList} role="group" aria-label={t("editor.whoCanPay")}>
                  {draft.participants.map(person => <button key={person.id} type="button" className="allocation-chip"
                    aria-pressed={draft.payerCandidateIds.includes(person.id)} onClick={() => togglePayerCandidate(person.id)}>{person.name}</button>)}
                </div>
              </div>}
            </fieldset>
          </section>
          <section className="panel item-panel">
            <div className="panel-heading">
              <h2> {t("editor.billItems")}{" "}
                <span className="inline-count">{draft.items.length}</span>
              </h2>
              <span className="muted">{t("editor.unitPrice")}</span>
            </div>
            <fieldset disabled={saving || (locked && !compactItems)}>
              {!draft.itemPayersEnabled && (
                <div className="legacy-payer-note">
                  <p className="field-hint">{t("editor.reimburseTheBillCreator")}</p>
                  <button type="button" className="text-link" disabled={locked || saving} onClick={() => update({ itemPayersEnabled: true })}> {t("editor.chooseWhoPaidForEachItem")} </button>
                </div>
              )}
              <div className={`editor-items ${styles.itemList}`}>
                {draft.items.map((item, index) => {
                  const props: BillItemProps = {
                    item, index, total: net(calcItems[index]).toFixed(2), participants: draft.participants,
                    payerCandidates: draft.payerCandidateIds.length
                      ? draft.participants.filter(person => draft.payerCandidateIds.includes(person.id) || person.id === item.payerId)
                      : draft.participants,
                    restaurants: draft.restaurants, itemPayersEnabled: draft.itemPayersEnabled,
                    locked, saving, allSelected: allParticipantsSelected(item),
                    onUpdate: (changes, immediate) => updateItem(item.id, changes, immediate),
                    onToggleParticipant: id => toggleParticipant(item, id),
                    onUpdateParts: (id, value) => updateParticipantParts(item, id, value),
                    onPromptPay: (id, promptPayId) => update({ participants: draft.participants.map(p => p.id === id ? { ...p, promptPayId } : p) }),
                    onRemove: () => update({ items: draft.items.filter(i => i.id !== item.id) }),
                  };
                  return compactItems
                    ? <BillItemMobile key={item.id} {...props} open={editingItemId === item.id} onOpen={() => setEditingItemId(item.id)} onClose={() => setEditingItemId(null)} />
                    : <BillItemDesktop key={item.id} {...props} />;
                })}
              </div>
              <button
                className="add-item-button"
                disabled={locked || saving || draft.items.length >= 300}
                onClick={() => { const item = { ...emptyItem(), payerId: draft.creatorParticipantId && payerCandidates.some(p => p.id === draft.creatorParticipantId) ? draft.creatorParticipantId : payerCandidates.length === 1 ? payerCandidates[0].id : null }; update({ items: [...draft.items, item] }); if (compactItems) setEditingItemId(item.id); }}
              >
                <Icon name="plus" size={18} /> {t("common.addItem")} </button>
              {draft.itemPayersEnabled && (selectedPayers.length > 0 || hasMissingPayer) && <div className={styles.payerRecipients}>
                <h3>{t("payer.receiversHeading")}</h3>
                <p className="field-hint">{t("payer.receiversHint")}</p>
                <fieldset disabled={locked || saving}>
                {selectedPayers.map((payer, index) => <ItemPayer key={payer.id} mode="recipient" people={draft.participants} payerId={payer.id} index={index}
                  paidUpfront={upfrontTotals.find(person => person.id === payer.id)?.paidUpfront.toFixed(2)}
                  accountPromptPayId={accountPromptPays.find(p => p.id === payer.id && p.accountUserId === payer.accountUserId)?.value}
                  onSelect={() => {}} onPromptPay={(id, promptPayId) => update({ participants: draft.participants.map(p => p.id === id ? { ...p, promptPayId } : p) })} />)}
                {hasMissingPayer && <div className={styles.unassignedPayer}>
                  <span>{t("payer.unassignedCount", [missingPayerCount])}</span>
                  <b>฿ {baht(unassignedUpfront)}</b>
                </div>}
                </fieldset>
              </div>}
            </fieldset>
            <div className="subtotal-line">
              <span>{t("editor.itemsAfterDiscounts")}</span>
              <b>฿ {baht(subtotal)}</b>
            </div>
          </section>
          <section className="panel">
            <div className={`panel-heading ${styles.chargeHeading}`}>
              <h2>{t("editor.additionalCharges")}</h2>
              <button type="button" className={`allocation-chip ${styles.vatIncludesSc}`}
                disabled={locked || saving} aria-pressed={draft.vatIncludesSc}
                onClick={() => update({ vatIncludesSc: !draft.vatIncludesSc })}>
                {t("editor.includeServiceChargeInVAT")}
              </button>
            </div>
            <fieldset disabled={locked || saving}>
              <div className="extras-grid">
                {(["serviceCharge", "vat"] as const).map((key) => (
                  <div className="field" key={key}>
                    <span>{key === "vat" ? "VAT" : "Service charge"}</span>
                    <div className="unit-field">
                      <input
                        aria-label={key === "vat" ? "VAT" : "Service charge"}
                        type="text"
                        inputMode="decimal"
                        maxLength={15}
                        autoComplete="off"
                        placeholder={t("editor.noExtraCharge")}
                        value={draft[`${key}Value`]}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d{0,12}(?:\.\d{0,2})?$/.test(value)) {
                            update({ [`${key}Value`]: value }, false);
                          }
                        }}
                      />
                      <div
                        className="unit-switch"
                        role="group"
                        aria-label={t("editor.chargeUnitLabel", [key === "vat" ? "VAT" : "Service charge"])}
                      >
                        {(["%", "฿"] as const).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            aria-label={unit === "%" ? t("editor.percentage") : t("common.baht")}
                            aria-pressed={draft[`${key}Type`] === unit}
                            onClick={() => update({ [`${key}Type`]: unit })}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </section>
        </div>
        <aside className="summary-sidebar" aria-label={t("editor.billSummary")} tabIndex={0}>
          <section className="summary-panel" id="summary">
            <div className="panel-heading">
              <h2>{t("editor.billSummary")}</h2>
              <span className="summary-live">
                <span className="live-dot" /> {t("editor.calculatedInstantly")} </span>
            </div>
            <div className={`summary-total ${!unroundedTotal.isInteger() ? styles.summaryTotal : ""}`}>
              <span>{t("bill.total")}</span>
              <div className={styles.totalRow}>
                <strong><small>฿</small> {baht(total)}</strong>
                {!unroundedTotal.isInteger() && <fieldset className={styles.rounding} disabled={locked || saving} aria-label={t("editor.rounding")}>
                  {(["up", "down"] as const).map(mode => {
                    const selected = draft.roundingMode === mode;
                    const label = t(mode === "up" ? "editor.roundingUp" : "editor.roundingDown");
                    return <button key={mode} type="button" className="allocation-chip" aria-pressed={selected}
                      aria-label={`${label} — ${t("editor.roundingToggleHint")}`} title={`${label} — ${t("editor.roundingToggleHint")}`}
                      onClick={() => update({ roundingMode: selected ? "none" : mode })}>
                      <span className={mode === "up" ? styles.roundUp : styles.roundDown}><Icon name="arrow" size={20} /></span>
                    </button>;
                  })}
                </fieldset>}
              </div>
              <p>
                {draft.items.length} {t("bill.itemsHeading")} {draft.participants.length} {t("common.people")} </p>
            </div>
            <div className="summary-breakdown">
              {restaurantTotals.map(restaurant => <div className={styles.restaurantTotal} key={restaurant.id}>
                <span>{restaurant.id ? t("editor.restaurantTotal", [restaurant.name]) : restaurant.name}</span>
                <b>{baht(restaurant.amount)}</b>
              </div>)}
              <div className={restaurantTotals.length ? styles.restaurantSubtotal : undefined}>
                <span>{t("editor.itemsSubtotal")}</span>
                <b>{baht(subtotal)}</b>
              </div>
              <div>
                <span>Service charge</span>
                <b>{baht(sc)}</b>
              </div>
              <div>
                <span>VAT</span>
                <b>{baht(vat)}</b>
              </div>
              {!roundingAdjustment.isZero() && <div><span>{t("editor.roundingAdjustment")}</span><b>{roundingAdjustment.gt(0) ? "+" : ""}{baht(roundingAdjustment)}</b></div>}
            </div>
            {draft.itemPayersEnabled ? (
              <SettlementSummary people={draft.participants} settlement={settlement}
                pending={hasUnassigned ? t("editor.selectParticipants") : hasMissingPayer ? t("common.chooseWhoPaid") : undefined} />
            ) : (
              <div className="per-person">
                <h3>{t("editor.eachPersonPays")}</h3>
                {result.participants.length ? result.participants.map((p, index) => (
                  <div className="person-total" key={p.id}>
                    <span className={`avatar small tone-${index % 4}`}>{nameInitial(p.name)}</span>
                    <span>{p.name}</span>
                    <b>{hasUnassigned ? t("editor.selectParticipants") : `฿ ${baht(p.totalPayable)}`}</b>
                  </div>
                )) : <p className="field-hint">{t("common.addFriendsToSeeIndividualTotals")}</p>}
              </div>
            )}
            {hasUnassigned && <p className="warning">{t("editor.someItemsHaveNoParticipantsSelected")}</p>}
            {hasMissingPayer && <p className="warning">{t("editor.payersIncomplete")}</p>}
            <div className="payment-settings">
              {!draft.itemPayersEnabled && <label className="field">
                <span>{t("editor.recipientPromptPay")}</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t("editor.mobileNumberNationalID")}
                  value={promptPay}
                  maxLength={13}
                  onChange={(e) =>
                    { setPromptPay(e.target.value.replace(/\D/g, "")); dirty.current = true; editRevision.current++; setSavedDirty(true); setAutoSaveError(""); }
                  }
                  disabled={saving}
                />
              </label>}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!draft.isPublic}
                  disabled={saving}
                  onChange={(e) => update({ isPublic: !e.target.checked })}
                />
                <Icon name="shield" size={16} /> {t("editor.requireAPINToOpenTheBill")} </label>
              {!draft.isPublic && (
                <PinInput
                  value={draft.passcode}
                  onChange={(passcode) => update({ passcode }, false)}
                  disabled={saving}
                  invalid={error === t("editor.setAFourDigitPIN")}
                />
              )}
            </div>
            {error && (
              <p className="error" role="alert">
                {feedback(error)}
              </p>
            )}
            {autoSaveError && <p className="error" role="alert">{feedback(autoSaveError)} <button type="button" className="text-link" onClick={() => setAutoSaveError("")}>{t("common.retry")}</button></p>}
            {notice && (
              <p className="success" role="status">
                {feedback(notice)}
              </p>
            )}
            {demo ? (
              <Link href="/new" className="button primary full-width"> {t("editor.createMyBill")} <Icon name="arrow" size={18} />
              </Link>
            ) : (
              <>
                <button
                  className="button primary full-width"
                  onClick={() => save(true)}
                  disabled={saving || autoSaving || savedDirty || personEditDirty || aliasSaving}
                >
                  {saving ? (
                    <span className="spinner" />
                  ) : (
                    <Icon name="link" size={18} />
                  )} {t(billStatus === "UNSHARED" ? "editor.shareAgain" : "editor.saveAndCreateShareLink")} </button>
              </>
            )}
            <p className="summary-footnote"> {t("editor.recalculationHint")} </p>
          </section>
        </aside>
      </div>
      <div className="mobile-summary">
        <div>
          <span>{t("bill.totalLabel")}</span>
          <strong>฿ {baht(total)}</strong>
        </div>
        <a className="button primary" href="#summary"> {t("editor.viewIndividualTotals")} <Icon name="arrow" size={16} />
        </a>
      </div>
      {(scrollPosition.canGoUp || scrollPosition.canGoDown) && <nav className={styles.scrollControls} aria-label={t("editor.pageNavigation")}>
        {(["up", "down"] as const).map(direction => <button key={direction} type="button"
          aria-label={t(direction === "up" ? "editor.scrollToTop" : "editor.scrollToBottom")}
          title={t(direction === "up" ? "editor.scrollToTop" : "editor.scrollToBottom")}
          disabled={direction === "up" ? !scrollPosition.canGoUp : !scrollPosition.canGoDown}
          onClick={() => window.scrollTo({ top: direction === "up" ? 0 : document.documentElement.scrollHeight,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>
          <Icon name="arrow" size={20} style={{ transform: `rotate(${direction === "up" ? -90 : 90}deg)` }} />
        </button>)}
      </nav>}
    </div>
  );
}
