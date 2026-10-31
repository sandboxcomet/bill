import { Decimal } from "decimal.js";

export type BaseParticipant = {
  id: string;
  name: string;
  totalPayable: Decimal;
};

export type BaseBillItem = {
  id: string;
  name: string;
  price: Decimal;
  quantity: number;
  discountRate: Decimal;
  isShared: boolean;
  includeSC?: boolean;
  includeVat?: boolean;
  consumers: string[]; // List of Participant IDs
  consumerQuantities?: Record<string, number>; // participantId → qty consumed (for custom qty split)
};

export type CalculateBillParams = {
  items: BaseBillItem[];
  participants: BaseParticipant[];
  serviceCharge: Decimal;
  vat: Decimal;
  grandTotal: Decimal;
};

export type CalculationResult = {
  participants: BaseParticipant[];
  matchError?: Decimal;
};

export function calculateBill(params: CalculateBillParams): CalculationResult {
  const { items, participants, serviceCharge, vat, grandTotal } = params;

  const updatedParticipants = participants.map((p) => ({
    ...p,
    totalPayable: new Decimal(0),
    subtotal: new Decimal(0),
    subtotalSC: new Decimal(0),
    subtotalVAT: new Decimal(0),
  }));

  let allParticipantsSubtotal = new Decimal(0);
  let allParticipantsSubtotalSC = new Decimal(0);
  let allParticipantsSubtotalVAT = new Decimal(0);

  // Step 1 & 2: Item Net Price & Participant Subtotal
  for (const item of items) {
    const price = new Decimal(item.price);
    const quantity = new Decimal(item.quantity);
    const discountRate = new Decimal(item.discountRate);

    // NetPrice = (Price * Quantity) * (1 - (DiscountRate / 100))
    const netPrice = price
      .mul(quantity)
      .mul(new Decimal(1).minus(discountRate.div(100)));

    const consumersIds = item.isShared
      ? updatedParticipants.map((p) => p.id)
      : item.consumers;

    if (consumersIds.length === 0) continue;

    const includeSC = item.includeSC ?? true;
    const includeVat = item.includeVat ?? true;

    // Determine if we have custom qty allocation
    const hasCustomQty =
      item.consumerQuantities &&
      Object.keys(item.consumerQuantities).length > 0;

    if (hasCustomQty) {
      // Custom qty split: each participant pays proportionally to their qty
      const cq = item.consumerQuantities!;
      const totalAllocatedQty = Object.values(cq).reduce((s, q) => s + q, 0);
      if (totalAllocatedQty === 0) continue;

      for (const [consumerId, qty] of Object.entries(cq)) {
        if (qty <= 0) continue;
        const pIndex = updatedParticipants.findIndex(
          (p) => p.id === consumerId,
        );
        if (pIndex === -1) continue;

        const share = netPrice.mul(qty).div(totalAllocatedQty);
        updatedParticipants[pIndex].subtotal =
          updatedParticipants[pIndex].subtotal.plus(share);
        allParticipantsSubtotal = allParticipantsSubtotal.plus(share);

        if (includeSC) {
          updatedParticipants[pIndex].subtotalSC =
            updatedParticipants[pIndex].subtotalSC.plus(share);
          allParticipantsSubtotalSC = allParticipantsSubtotalSC.plus(share);
        }
        if (includeVat) {
          updatedParticipants[pIndex].subtotalVAT =
            updatedParticipants[pIndex].subtotalVAT.plus(share);
          allParticipantsSubtotalVAT = allParticipantsSubtotalVAT.plus(share);
        }
      }
    } else {
      // Equal split among consumers
      const pricePerConsumer = netPrice.div(consumersIds.length);

      for (const consumerId of consumersIds) {
        const pIndex = updatedParticipants.findIndex(
          (p) => p.id === consumerId,
        );
        if (pIndex !== -1) {
          updatedParticipants[pIndex].subtotal =
            updatedParticipants[pIndex].subtotal.plus(pricePerConsumer);
          allParticipantsSubtotal =
            allParticipantsSubtotal.plus(pricePerConsumer);

          if (includeSC) {
            updatedParticipants[pIndex].subtotalSC =
              updatedParticipants[pIndex].subtotalSC.plus(pricePerConsumer);
            allParticipantsSubtotalSC =
              allParticipantsSubtotalSC.plus(pricePerConsumer);
          }
          if (includeVat) {
            updatedParticipants[pIndex].subtotalVAT =
              updatedParticipants[pIndex].subtotalVAT.plus(pricePerConsumer);
            allParticipantsSubtotalVAT =
              allParticipantsSubtotalVAT.plus(pricePerConsumer);
          }
        }
      }
    }
  }

  // Step 3 & 4: Pro-rata SC + VAT + Final Total
  let currentCalculatedTotal = new Decimal(0);

  for (const p of updatedParticipants) {
    let scRatio = new Decimal(0);
    if (!allParticipantsSubtotalSC.isZero()) {
      scRatio = p.subtotalSC.div(allParticipantsSubtotalSC);
    } else if (
      updatedParticipants.length > 0 &&
      new Decimal(serviceCharge).gt(0)
    ) {
      scRatio = new Decimal(1).div(updatedParticipants.length);
    }

    let vatRatio = new Decimal(0);
    if (!allParticipantsSubtotalVAT.isZero()) {
      vatRatio = p.subtotalVAT.div(allParticipantsSubtotalVAT);
    } else if (updatedParticipants.length > 0 && new Decimal(vat).gt(0)) {
      vatRatio = new Decimal(1).div(updatedParticipants.length);
    }

    const participantSC = scRatio.mul(new Decimal(serviceCharge));
    const participantVAT = vatRatio.mul(new Decimal(vat));

    p.totalPayable = p.subtotal
      .plus(participantSC)
      .plus(participantVAT)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    currentCalculatedTotal = currentCalculatedTotal.plus(p.totalPayable);
  }

  const originalTotal = items.reduce((sum, item) => sum.plus(item.price.mul(item.quantity)
    .mul(new Decimal(1).minus(item.discountRate.div(100)))), new Decimal(0))
    .toDecimalPlaces(2).plus(serviceCharge).plus(vat);
  if (!grandTotal.eq(originalTotal) && currentCalculatedTotal.gt(0)) {
    const exact = updatedParticipants.map(p => p.totalPayable.mul(grandTotal).div(currentCalculatedTotal).mul(100));
    const cents = exact.map(value => value.floor());
    let remaining = grandTotal.mul(100).round().minus(Decimal.sum(0, ...cents)).toNumber();
    const order = exact.map((value, i) => ({ i, fraction: value.minus(cents[i]) }))
      .sort((a, b) => b.fraction.comparedTo(a.fraction) || participants[a.i].id.localeCompare(participants[b.i].id));
    for (let i = 0; remaining > 0 && order.length; i++, remaining--) cents[order[i % order.length].i] = cents[order[i % order.length].i].plus(1);
    updatedParticipants.forEach((p, i) => { p.totalPayable = cents[i].div(100); });
    currentCalculatedTotal = Decimal.sum(0, ...updatedParticipants.map(p => p.totalPayable));
  }

  // Rounding Fix — add/subtract residual to first participant
  const gtDecimal = new Decimal(grandTotal);
  const matchError = gtDecimal.minus(currentCalculatedTotal);

  if (!matchError.isZero() && updatedParticipants.length > 0) {
    updatedParticipants[0].totalPayable =
      updatedParticipants[0].totalPayable.plus(matchError);
  }

  const finalParticipants: BaseParticipant[] = updatedParticipants.map((p) => ({
    id: p.id,
    name: p.name,
    totalPayable: p.totalPayable,
  }));

  return { participants: finalParticipants, matchError };
}
