import Decimal from "decimal.js";
import type { BillEditorItem, BillEditorPerson } from "@/components/bill-item-types";

type ComparableDraft = {
  name: string; restaurants: { id: string; name: string }[]; participants: BillEditorPerson[];
  payerCandidateIds?: string[]; itemPayersEnabled: boolean; items: BillEditorItem[];
  serviceChargeValue: string; serviceChargeType: string; vatValue: string; vatType: string;
  vatIncludesSc: boolean; roundingMode: string; isPublic: boolean; passcode: string;
};

// Compare every persisted editor field. Never treat an invalid or unfamiliar
// recovery record as saved: it must remain available for manual comparison.
export function sameSavedBillDraft(left: ComparableDraft, right: ComparableDraft): boolean {
  const number = (value: unknown) => {
    const amount = new Decimal(value === "" || value == null ? 0 : String(value));
    if (!amount.isFinite()) throw new Error("Invalid amount");
    return amount.toString();
  };
  const normalize = (draft: ComparableDraft) => ({
    name: draft.name, restaurants: draft.restaurants,
    itemPayersEnabled: draft.itemPayersEnabled,
    payerCandidateIds: [...(draft.payerCandidateIds ?? [])].sort(),
    participants: draft.participants.map(p => ({ id: p.id, name: p.name, accountUserId: p.accountUserId ?? null,
      isPayer: p.isPayer, promptPayId: p.promptPayId || null })).sort((a, b) => a.id.localeCompare(b.id)),
    items: draft.items.map(i => ({ id: i.id, name: i.name, price: number(i.price), quantity: i.quantity,
      discountRate: number(i.discountRate), isShared: i.isShared, includeSC: i.includeSC, includeVat: i.includeVat,
      consumers: [...i.consumers].sort(), consumerQuantities: Object.entries(i.consumerQuantities ?? {}).sort(([a], [b]) => a.localeCompare(b)),
      payerId: i.payerId ?? null, restaurantId: i.restaurantId ?? null })).sort((a, b) => a.id.localeCompare(b.id)),
    serviceChargeValue: number(draft.serviceChargeValue), serviceChargeType: draft.serviceChargeType,
    vatValue: number(draft.vatValue), vatType: draft.vatType, vatIncludesSc: draft.vatIncludesSc,
    roundingMode: draft.roundingMode, isPublic: draft.isPublic, passcode: draft.isPublic ? null : draft.passcode,
  });
  try { return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right)); }
  catch { return false; }
}
