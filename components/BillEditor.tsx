"use client";
import { nameInitial } from "@/lib/name-initial";
import { useI18n, useLocalizedRouter } from "@/components/LanguageProvider";
import Link from "@/components/LocalizedLink";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Decimal from "decimal.js";
import { calculateBill } from "@/lib/billing";
import { createDraftBill } from "@/app/actions/bill";
import { baht, jsonBody, request } from "@/lib/client";
import { Icon } from "./Icons";
import SettlementSummary from "./SettlementSummary";
import ItemPayer from "./ItemPayer";
import { calculateSettlements, isPromptPayId } from "@/lib/settlements";
import PartsHelp from "./PartsHelp";
import PinInput from "./PinInput";
import BillPeoplePicker from "./BillPeoplePicker";
import type { AccountPerson } from "@/lib/social";
import { isBillPin } from "@/lib/pin";
type Person = { id: string; name: string; isPayer: boolean; promptPayId?: string | null; accountUserId?: number | null; canonicalAccountUserId?: number; username?: string; hasPromptPay?: boolean };
type Item = {
  id: string;
  name: string;
  price: string;
  quantity: number;
  discountRate: string;
  isShared: boolean;
  includeSC: boolean;
  includeVat: boolean;
  consumers: string[];
  consumerQuantities?: Record<string, number>;
  payerId?: string | null;
};
type Draft = {
  name: string;
  participants: Person[];
  creatorInitialized?: boolean;
  creatorParticipantId?: string;
  itemPayersEnabled: boolean;
  items: Item[];
  serviceChargeValue: string;
  serviceChargeType: "%" | "฿";
  vatValue: string;
  vatType: "%" | "฿";
  vatIncludesSc: boolean;
  isPublic: boolean;
  passcode: string;
};
const uid = () => crypto.randomUUID();
const emptyItem = (): Item => ({
  id: uid(),
  name: "",
  price: "",
  quantity: 1,
  discountRate: "",
  isShared: true,
  includeSC: true,
  includeVat: true,
  consumers: [],
});
const initial: Draft = {
  name: "",
  itemPayersEnabled: true,
  participants: [],
  items: [],
  serviceChargeValue: "",
  serviceChargeType: "%",
  vatValue: "",
  vatType: "%",
  vatIncludesSc: false,
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
  const creatorName = (
    session?.user?.nickname?.trim() ||
    session?.user?.name?.trim() ||
    t("bill.creator")
  ).slice(0, 191);
  const router = useLocalizedRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [loaded, setLoaded] = useState(false);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(billId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [promptPay, setPromptPay] = useState("");
  const [profilePromptPay, setProfilePromptPay] = useState<{ userId: string; value: string } | null>(null);
  const [billStatus, setBillStatus] = useState("DRAFT");
  const [locked, setLocked] = useState(false);
  const [savedDirty, setSavedDirty] = useState(false);
  const version = useRef(0);
  const idRef = useRef(billId);
  const saveGuard = useRef(false);
  const dirty = useRef(false);
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
      accountUserId: Number(session?.user?.id),
      username: session?.user?.username ?? undefined,
    });
    const freshDraft = (): Draft => {
      const people: Person[] = repeatGroup?.people?.map(p => ({ ...p, id: uid(), isPayer: false })) ?? repeatGroup?.members?.map(p => ({ id: uid(), name: p.name, isPayer: false, accountUserId: p.id, username: p.username, hasPromptPay: p.hasPromptPay }))
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
      const restored: Draft =
        parsed &&
        Array.isArray(parsed.items) &&
        Array.isArray(parsed.participants)
          ? {
              ...parsed,
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
        `/login?callbackUrl=${encodeURIComponent(`/bills/${billId}/edit`)}`,
      );
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request<any>(`/api/bills/${billId}`)
      .then(({ bill }) => {
        if (!active) return;
        version.current = bill.version;
        setBillStatus(bill.status);
        if (bill.status === "CANCELLED") {
          router.replace(`/bill/${billId}`);
          return;
        }
        setLocked(
          bill.hasPaymentEvidence ||
            bill.participants.some(
              (p: any) => p.isPaid || Number(p.paidAmount) > 0,
            ),
        );
        setDraft({
          name: bill.name,
          itemPayersEnabled: bill.itemPayersEnabled,
          participants: bill.participants,
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
          isPublic: bill.isPublic,
          passcode: bill.passcode ?? "",
        });
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
  }, [billId, status, router, attempt]);
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
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      setNotice(
        t("errors.draftStorageUnavailable"),
      );
    }
  }, [draft, loaded, billId, demo, draftKey, loadedDraftKey, status]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current && idRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function update(data: Partial<Draft>) {
    dirty.current = true;
    setSavedDirty(true);
    setNotice("");
    setDraft((d) => ({ ...d, ...data }));
  }
  function updateItem(id: string, changes: Partial<Item>) {
    update({
      items: draft.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    });
  }
  function allParticipantsSelected(item: Item) {
    return (
      item.isShared ||
      (draft.participants.length > 0 &&
        draft.participants.every((p) => item.consumers.includes(p.id)))
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
    });
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
  const total = subtotal.plus(sc).plus(vat);
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
  const hasMissingPayer = draft.itemPayersEnabled && draft.items.some((i) => !draft.participants.some((p) => p.id === i.payerId));
  const hasUnassigned = draft.items.some(
    (i) =>
      !i.isShared &&
      !(i.consumerQuantities
        ? Object.values(i.consumerQuantities).some((q) => q > 0)
        : i.consumers.length),
  );
  const addPerson = (value: string) => {
    const name = value.trim();
    if (!name) return false;
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
    const additions = [...new Map(people.map(p => [p.id, p])).values()].filter(p => !draft.participants.some(existing => (existing.canonicalAccountUserId ?? existing.accountUserId) === p.id));
    if (draft.participants.length + additions.length > 100) { setError(t("errors.participantLimit")); return false; }
    update({ participants: [...draft.participants.map(existing => {
      const account = people.find(p => p.id === (existing.canonicalAccountUserId ?? existing.accountUserId));
      return account ? { ...existing, name: account.name, username: account.username, hasPromptPay: account.hasPromptPay } : existing;
    }), ...additions.map(p => ({ id: uid(), name: p.name, isPayer: false,
      accountUserId: p.id, username: p.username, hasPromptPay: p.hasPromptPay }))] });
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
      image: session.user.image ?? null,
      hasPromptPay: profilePromptPay?.userId === session.user.id && Boolean(profilePromptPay.value),
    }]);
  }
  function removePerson(id: string) {
    update({
      participants: draft.participants.filter((p) => p.id !== id),
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
  async function save(publish = false) {
    if (saveGuard.current || demo) return;
    setError("");
    setNotice("");
    if (!loaded) {
      setError(t("errors.billNotLoaded"));
      return;
    }
    if (!draft.name.trim()) {
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
    setSaving(true);
    try {
      const id = idRef.current ?? (await createDraftBill());
      idRef.current = id;
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
      const saved = await request<{ version: number }>(`/api/bills/${id}`, {
        method: "PATCH",
        ...jsonBody(
          locked
            ? {
                version: version.current,
                name: draft.name,
                isPublic: draft.isPublic,
                passcode: draft.isPublic ? null : draft.passcode,
              }
            : payload,
        ),
      });
      version.current = saved.version;
      dirty.current = false;
      setSavedDirty(false);
      if (!billId && draftKey)
        try {
          localStorage.setItem(
            draftKey,
            JSON.stringify({ ...initial, items: [] }),
          );
        } catch {}
      if (publish) {
        router.push(`/bill/${id}`);
      } else {
        setNotice(t("editor.draftSaved"));
        if (!billId) router.replace(`/bills/${id}/edit`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    } finally {
      setSaving(false);
      saveGuard.current = false;
    }
  }
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
              dirty.current &&
              idRef.current &&
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
            : savedDirty
              ? billId
                ? t("editor.unsavedChanges")
                : t("editor.draftSavedOnThisDevice")
              : t("editor.readyToEdit")}
        </span>
      </div>
      <div className="page-heading">
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
        <span className="status status-draft">
          {billStatus === "PUBLISHED" ? t("bill.status.published") : t("bill.status.draft")}
        </span>
      </div>
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
                onChange={(e) => update({ name: e.target.value })}
                maxLength={191}
                placeholder={t("editor.billNamePlaceholder")}
              />
            </label>
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
                  <span className="person-chip" key={p.id}>
                    <span className={`avatar small tone-${index % 4}`}>
                      {nameInitial(p.name)}
                    </span>
                    {p.name}{p.username && <small>@{p.username}</small>}
                    <button
                      className="chip-remove"
                      aria-label={t("editor.removePerson", [p.name])}
                      onClick={() => removePerson(p.id)}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                ))}
              </div>
              {canAddSelf && <button type="button" className="button secondary button-small" onClick={addSelf}>
                <Icon name="plus" size={17} /> {t("editor.addMyself")}
              </button>}
              <BillPeoplePicker onAdd={addAccounts} onAddName={addPerson} disabled={locked || saving} allowAccounts={!demo}
                selectedAccountIds={draft.participants.flatMap(person => {
                  const id = person.canonicalAccountUserId ?? person.accountUserId;
                  return id == null ? [] : [id];
                })} />
              {!draft.participants.length && (
                <p className="field-hint"> {t("editor.participantsEmpty")} </p>
              )}
            </fieldset>
          </section>
          <section className="panel item-panel">
            <div className="panel-heading">
              <h2> {t("editor.billItems")}{" "}
                <span className="inline-count">{draft.items.length}</span>
              </h2>
              <span className="muted">{t("editor.unitPrice")}</span>
            </div>
            <fieldset disabled={locked || saving}>
              {!draft.itemPayersEnabled && (
                <div className="legacy-payer-note">
                  <p className="field-hint">{t("editor.reimburseTheBillCreator")}</p>
                  <button type="button" className="text-link" onClick={() => update({ itemPayersEnabled: true })}> {t("editor.chooseWhoPaidForEachItem")} </button>
                </div>
              )}
              <div className="editor-items">
                {draft.items.map((item, index) => (
                  <div className="editor-item" key={item.id}>
                    <div className="item-index">{index + 1}</div>
                    <div className="item-fields">
                      <label className="field item-name">
                        <span>{t("bill.item")}</span>
                        <input
                          aria-label={t("editor.itemNameLabel", [index + 1])}
                          maxLength={191}
                          placeholder={t("editor.itemNamePlaceholder")}
                          value={item.name}
                          onChange={(e) =>
                            updateItem(item.id, { name: e.target.value })
                          }
                        />
                      </label>
                      <label className="field item-price">
                        <span>{t("editor.price")}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={item.price}
                          placeholder="0.00"
                          aria-label={t("editor.itemPriceLabel", [index + 1])}
                          onChange={(e) =>
                            updateItem(item.id, { price: e.target.value })
                          }
                        />
                      </label>
                      <label className="field item-quantity">
                        <span>{t("bill.quantity")}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="999"
                          value={item.quantity || ""}
                          aria-label={t("editor.itemQuantityLabel", [index + 1])}
                          onChange={(e) =>
                            updateItem(item.id, {
                              quantity: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <button
                        className="icon-button remove-item"
                        aria-label={t("editor.removeItem", [index + 1])}
                        onClick={() =>
                          update({
                            items: draft.items.filter((i) => i.id !== item.id),
                          })
                        }
                      >
                        <Icon name="close" size={17} />
                      </button>
                    </div>
                    <div
                      className="item-allocation"
                      role="group"
                      aria-label={t("editor.itemParticipantsLabel", [index + 1])}
                    >
                      <button
                        type="button"
                        className="allocation-all"
                        aria-pressed={allParticipantsSelected(item)}
                        onClick={() =>
                          updateItem(item.id, {
                            isShared: !allParticipantsSelected(item),
                            consumerQuantities: undefined,
                            consumers: [],
                          })
                        }
                      > {t("common.splitWithEveryone")} </button>
                      <div className="allocation-chips">
                        {draft.participants.length ? (
                          draft.participants.map((p) => (
                            <button
                              type="button"
                              className="allocation-chip"
                              aria-pressed={
                                item.isShared || item.consumers.includes(p.id)
                              }
                              key={p.id}
                              onClick={() => toggleParticipant(item, p.id)}
                            >
                              {p.name}
                            </button>
                          ))
                        ) : (
                          <span className="field-hint"> {t("editor.addFriendsToSelectParticipants")} </span>
                        )}
                      </div>
                      <span className="item-net">
                        ฿ {baht(net(calcItems[index]))}
                      </span>
                    </div>
                    {draft.itemPayersEnabled && (
                      <ItemPayer people={draft.participants} payerId={item.payerId} index={index}
                        onSelect={(payerId) => updateItem(item.id, { payerId })}
                        onPromptPay={(id, promptPayId) => update({ participants: draft.participants.map((p) => p.id === id ? { ...p, promptPayId } : p) })} />
                    )}
                    <details className="item-details">
                      <summary>{t("editor.discountAndSplitOptions")}</summary>
                      <div className="details-fields">
                        <label className="field discount-field">
                          <span>{t("bill.discount")}</span>
                          <span className="number-field">
                            <input
                              type="text"
                              inputMode="decimal"
                              maxLength={6}
                              autoComplete="off"
                              aria-label={t("editor.itemDiscountLabel", [index + 1])}
                              value={item.discountRate}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (
                                  /^\d{0,3}(?:\.\d{0,2})?$/.test(value) &&
                                  (value === "." || Number(value) <= 100)
                                ) {
                                  updateItem(item.id, { discountRate: value });
                                }
                              }}
                            />
                            <span className="number-unit" aria-hidden="true">
                              %
                            </span>
                          </span>
                        </label>
                        <div className="field item-tax-controls">
                          <span>{t("editor.serviceChargeAndVAT")}</span>
                          <div
                            className="item-tax-toggles"
                            role="group"
                            aria-label={t("editor.itemChargesLabel", [index + 1])}
                          >
                            <button
                              type="button"
                              className="allocation-chip"
                              aria-pressed={item.includeSC}
                              aria-label={t("editor.itemServiceChargeLabel", [index + 1])}
                              onClick={() =>
                                updateItem(item.id, { includeSC: !item.includeSC })
                              }
                            >
                              Service charge
                            </button>
                            <button
                              type="button"
                              className="allocation-chip"
                              aria-pressed={item.includeVat}
                              aria-label={t("editor.itemVatLabel", [index + 1])}
                              onClick={() =>
                                updateItem(item.id, { includeVat: !item.includeVat })
                              }
                            >
                              VAT
                            </button>
                          </div>
                        </div>
                      </div>
                      {draft.participants.length > 0 && (
                        <div className="custom-quantities">
                          <PartsHelp id={item.id} />
                          <p id={`parts-help-${item.id}`} className="field-hint">
                            {Object.keys(item.consumerQuantities ?? {}).length
                              ? t("editor.excludedPersonHint")
                              : t("editor.equalSplitHint")}
                          </p>
                          <div className="parts-fields">
                            {draft.participants.map((p) => (
                              <label className="field" key={p.id}>
                                <span>{p.name}</span>
                                <span className="number-field">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={3}
                                    autoComplete="off"
                                    aria-label={t("editor.personSharesLabel", [p.name, index + 1])}
                                    aria-describedby={`parts-help-${item.id}`}
                                    value={item.consumerQuantities?.[p.id] || ""}
                                    onChange={(e) =>
                                      updateParticipantParts(
                                        item,
                                        p.id,
                                        e.target.value,
                                      )
                                    }
                                  />
                                  <span className="number-unit" aria-hidden="true"> {t("editor.shares")} </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </details>
                  </div>
                ))}
              </div>
              <button
                className="add-item-button"
                disabled={draft.items.length >= 300}
                onClick={() => update({ items: [...draft.items, { ...emptyItem(), payerId: draft.participants.some((p) => p.id === draft.creatorParticipantId) ? draft.creatorParticipantId : null }] })}
              >
                <Icon name="plus" size={18} /> {t("common.addItem")} </button>
            </fieldset>
            <div className="subtotal-line">
              <span>{t("editor.itemsAfterDiscounts")}</span>
              <b>฿ {baht(subtotal)}</b>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>{t("editor.additionalCharges")}</h2>
              <span className="muted">{t("common.optional")}</span>
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
                            update({ [`${key}Value`]: value });
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
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.vatIncludesSc}
                  onChange={(e) => update({ vatIncludesSc: e.target.checked })}
                /> {t("editor.includeServiceChargeInVAT")} </label>
            </fieldset>
          </section>
        </div>
        <aside className="summary-sidebar">
          <section className="summary-panel" id="summary">
            <div className="panel-heading">
              <h2>{t("editor.billSummary")}</h2>
              <span className="summary-live">
                <span className="live-dot" /> {t("editor.calculatedInstantly")} </span>
            </div>
            <div className="summary-total">
              <span>{t("bill.total")}</span>
              <strong>
                <small>฿</small> {baht(total)}
              </strong>
              <p>
                {draft.items.length} {t("bill.itemsHeading")} {draft.participants.length} {t("common.people")} </p>
            </div>
            <div className="summary-breakdown">
              <div>
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
                    setPromptPay(e.target.value.replace(/\D/g, ""))
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
                  onChange={(passcode) => update({ passcode })}
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
                  disabled={saving}
                >
                  {saving ? (
                    <span className="spinner" />
                  ) : (
                    <Icon name="link" size={18} />
                  )} {t("editor.saveAndCreateShareLink")} </button>
                <button
                  className="button secondary full-width"
                  onClick={() => save(false)}
                  disabled={saving}
                > {t("common.save")}{billStatus === "DRAFT" ? t("bill.status.draft") : t("editor.changes")}
                </button>
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
    </div>
  );
}
