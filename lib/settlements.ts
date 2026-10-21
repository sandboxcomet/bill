import Decimal from "decimal.js";
import type { CalculateBillParams } from "./billing";

type Params = Omit<CalculateBillParams, "items"> & {
  items: (CalculateBillParams["items"][number] & {
    payerId?: string | null;
  })[];
};

// Largest remainders conserve satang without making a small share negative.
// IDs break ties so reloading participants in a different order changes nothing.
function roundAmounts(values: Decimal[], total: Decimal, ids: string[]) {
  const cents = values.map((v) => v.mul(100).floor());
  let remaining = total.mul(100).round()
    .minus(Decimal.sum(0, ...cents)).toNumber();
  const order = values
    .map((v, i) => ({ i, fraction: v.mul(100).minus(cents[i]) }))
    .sort((a, b) => b.fraction.comparedTo(a.fraction) ||
      (ids[a.i] < ids[b.i] ? -1 : 1));
  for (let i = 0; remaining > 0 && order.length; i++, remaining--) {
    const index = order[i % order.length].i;
    cents[index] = cents[index].plus(1);
  }
  return cents.map((v) => v.div(100));
}

function distribute(total: Decimal, weights: Decimal[]) {
  const sum = Decimal.sum(0, ...weights);
  return weights.map((w) => sum.gt(0)
    ? total.mul(w).div(sum)
    : total.div(weights.length || 1));
}

/** Reimburse actual payers; offset reciprocal payments only within the same pair. */
export function calculateSettlements(params: Params) {
  const { participants, items, serviceCharge, vat, grandTotal } = params;
  const incomplete = items.some((item) => {
    const hasPayer = participants.some((p) => p.id === item.payerId);
    const hasConsumers = item.isShared || (item.consumerQuantities
      ? Object.values(item.consumerQuantities).some((q) => q > 0)
      : item.consumers.length > 0);
    return !hasPayer || !hasConsumers;
  });
  if (!participants.length || !items.length || incomplete) return null;

  const ids = participants.map((p) => p.id);
  const nets = items.map((item) => item.price.mul(item.quantity)
    .mul(new Decimal(1).minus(item.discountRate.div(100))));
  const chargeWeights = (key: "includeSC" | "includeVat") => {
    const eligible = items.map((item, i) =>
      item[key] === false ? new Decimal(0) : nets[i]);
    return Decimal.sum(0, ...eligible).gt(0) ? eligible : nets;
  };
  const scByItem = distribute(serviceCharge, chargeWeights("includeSC"));
  const vatByItem = distribute(vat, chargeWeights("includeVat"));
  // Use item content for tie-breaking: database-generated item IDs change on save.
  const itemKeys = items.map((item) => JSON.stringify([
    item.payerId, item.name, item.price.toString(), item.quantity,
    item.discountRate.toString(), item.includeSC, item.includeVat, item.isShared,
    [...item.consumers].sort(), Object.entries(item.consumerQuantities ?? {}).sort(),
  ]));
  const itemTotals = roundAmounts(nets.map((net, i) =>
    net.plus(scByItem[i]).plus(vatByItem[i])), grandTotal, itemKeys);
  // Attribution only: preserve the existing ledger totals and share rounding.
  // Independently conserve each bill component; show any per-person difference
  // explicitly as a satang adjustment instead of changing what anyone owes.
  const bases = roundAmounts(nets, grandTotal.minus(serviceCharge).minus(vat), itemKeys);
  const charges = roundAmounts(scByItem, serviceCharge, itemKeys);
  const taxes = roundAmounts(vatByItem, vat, itemKeys);
  const shares = participants.map(() => new Decimal(0));
  const upfront = participants.map(() => new Decimal(0));
  const itemAllocations: {
    itemId: string;
    payerId: string;
    total: Decimal;
    shares: { participantId: string; amount: Decimal; baseAmount: Decimal;
      serviceCharge: Decimal; vat: Decimal; roundingAdjustment: Decimal }[];
  }[] = [];
  const pairs = new Map<string, {
    fromParticipantId: string;
    toParticipantId: string;
    amount: Decimal;
  }>();
  items.forEach((item, index) => {
    const payer = participants.findIndex((p) => p.id === item.payerId);
    upfront[payer] = upfront[payer].plus(itemTotals[index]);
    const custom = item.consumerQuantities &&
      Object.values(item.consumerQuantities).some((q) => q > 0);
    const weights = participants.map((p) => new Decimal(custom
      ? item.consumerQuantities![p.id] ?? 0
      : item.isShared || item.consumers.includes(p.id) ? 1 : 0));
    const itemShares = roundAmounts(distribute(itemTotals[index], weights), itemTotals[index], ids);
    const baseShares = roundAmounts(distribute(bases[index], weights), bases[index], ids);
    const chargeShares = roundAmounts(distribute(charges[index], weights), charges[index], ids);
    const taxShares = roundAmounts(distribute(taxes[index], weights), taxes[index], ids);
    itemAllocations.push({ itemId: item.id, payerId: ids[payer], total: itemTotals[index],
      shares: itemShares.map((amount, i) => ({ participantId: ids[i], amount,
        baseAmount: baseShares[i], serviceCharge: chargeShares[i], vat: taxShares[i],
        roundingAdjustment: amount.minus(baseShares[i]).minus(chargeShares[i]).minus(taxShares[i]),
      })) });
    itemShares.forEach((amount, consumer) => {
      shares[consumer] = shares[consumer].plus(amount);
      if (consumer === payer || amount.isZero()) return;
      const fromParticipantId = ids[consumer], toParticipantId = ids[payer];
      const key = `${fromParticipantId}:${toParticipantId}`;
      const previous = pairs.get(key);
      pairs.set(key, { fromParticipantId, toParticipantId,
        amount: amount.plus(previous?.amount ?? 0) });
    });
  });
  // Cancel only A→B against B→A. Never reroute C's payment through A or B.
  const transfers = [...pairs.values()].flatMap((payment) => {
    const reverse = pairs.get(`${payment.toParticipantId}:${payment.fromParticipantId}`);
    const amount = payment.amount.minus(reverse?.amount ?? 0);
    return amount.gt(0) ? [{ ...payment, amount }] : [];
  }).sort((a, b) => {
    const left = `${a.fromParticipantId}:${a.toParticipantId}`;
    const right = `${b.fromParticipantId}:${b.toParticipantId}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const balances = participants.map((p, i) => ({
    ...p,
    shareAmount: shares[i],
    paidUpfront: upfront[i],
    balance: upfront[i].minus(shares[i]),
    amountToPay: Decimal.sum(0, ...transfers
      .filter((t) => t.fromParticipantId === p.id).map((t) => t.amount)),
    amountToReceive: Decimal.sum(0, ...transfers
      .filter((t) => t.toParticipantId === p.id).map((t) => t.amount)),
  }));
  return { participants: balances, transfers, itemAllocations };
}

export const isPromptPayId = (value: string) => /^(0\d{9}|\d{13})$/.test(value);
