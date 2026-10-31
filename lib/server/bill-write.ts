import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { AccessError } from "./authorization";
import { calculateBill } from "@/lib/billing";
import { calculateSettlements, isPromptPayId } from "@/lib/settlements";
import { writeSettlementTransfers } from "./settlement-ledger";
import { autoFriend } from "./social";
import { isBillPin } from "@/lib/pin";
import { ownsAccount, primaryProfile, resolvedProfileFields } from "./account-identity";
import { participantPromptPay, participantPromptPayFields } from "./participant-promptpay";

const editorPayers = { participants: { where: { archived: false }, select: { id: true, accountUserId: true, ...participantPromptPayFields } } } as const;
import { roundBillTotal, type BillRounding } from "@/lib/bill-rounding";

export function money(value: unknown, field: string): Decimal {
  if (typeof value !== "number" && typeof value !== "string")
    throw new AccessError(`Invalid ${field}`, 409);
  let d: Decimal;
  try {
    d = new Decimal(value);
  } catch {
    throw new AccessError(`Invalid ${field}`, 409);
  }
  if (
    !d.isFinite() ||
    d.isNegative() ||
    d.gt("999999999999.99") ||
    d.decimalPlaces() > 2
  )
    throw new AccessError(`Invalid ${field}`, 409);
  return d;
}
export function label(
  value: unknown,
  field: string,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && !value.trim()) ||
    value.length > 191
  )
    throw new AccessError(`Invalid ${field}`, 409);
  return value.trim();
}
export function identity(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{6,100}$/.test(value))
    throw new AccessError("Invalid identity", 409);
  return value;
}

export async function saveBill(id: string, userId: number, body: any) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM bills WHERE id = ${id} FOR UPDATE`;
    const bill = await tx.bill.findUnique({
      where: { id },
      include: { participants: true, settlements: true },
    });
    if (!bill || !await ownsAccount(userId, bill.userId, tx))
      throw new AccessError("Not found", 404);
    if (body.version !== bill.version)
      throw new AccessError("บิลถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดใหม่", 409);
    const status = body.status ?? bill.status;
    if (
      !["DRAFT", "PUBLISHED", "UNSHARED", "CANCELLED"].includes(status) ||
      bill.status === "CANCELLED" ||
      (["PUBLISHED", "UNSHARED"].includes(bill.status) && status === "DRAFT") ||
      (status === "UNSHARED" && !["PUBLISHED", "UNSHARED"].includes(bill.status))
    )
      throw new AccessError("Invalid bill transition", 409);
    // Closing a published link must not rewrite or revalidate its saved contents.
    if (bill.status === "PUBLISHED" && status === "UNSHARED" &&
      Object.keys(body).every(key => key === "version" || key === "status")) {
      return tx.bill.update({ where: { id }, data: { status, version: { increment: 1 } }, include: editorPayers });
    }
    const editing =
      Array.isArray(body.items) || Array.isArray(body.participants);
    const itemPayersEnabled = bill.itemPayersEnabled || body.itemPayersEnabled === true;
    if (body.itemPayersEnabled !== undefined && typeof body.itemPayersEnabled !== "boolean")
      throw new AccessError("Invalid payer mode", 409);
    if (!editing && itemPayersEnabled !== bill.itemPayersEnabled)
      throw new AccessError("Select payers with complete bill data", 409);
    if (editing) {
      const evidenceCount = await tx.paymentEvidence.count({
        where: {
          status: { notIn: ["REJECTED", "SUPERSEDED"] },
          OR: [
            { targetType: "participant", targetId: { in: bill.participants.map((p) => p.id) } },
            { targetType: "settlement", targetId: { in: bill.settlements.map((s) => s.id) } },
          ],
        },
      });
      if (
        evidenceCount ||
        bill.participants.some((p) => p.paidAmount.gt(0) || p.isPaid)
      )
        throw new AccessError(
          "บิลมีหลักฐานการจ่ายแล้ว ไม่สามารถเปลี่ยนยอดหรือผู้ร่วมบิลได้",
          409,
        );
      if (
        !Array.isArray(body.items) ||
        body.items.length > 300 ||
        !Array.isArray(body.participants) ||
        body.participants.length > 100
      )
        throw new AccessError("Invalid bill contents", 409);
      const restaurants = body.restaurants ?? [];
      if (!Array.isArray(restaurants) || restaurants.length > 100)
        throw new AccessError("Invalid restaurants", 409);
      const normalizedRestaurants = restaurants.map((r: any) => ({
        id: identity(r.id), name: label(r.name, "restaurant"),
      }));
      const restaurantIds = new Set<string>(normalizedRestaurants.map((r: { id: string }) => r.id));
      if (restaurantIds.size !== normalizedRestaurants.length)
        throw new AccessError("Duplicate restaurant ID", 409);
      const linkedIds: number[] = body.participants.flatMap((p: any) => {
        if (p.accountUserId == null) return [];
        if (!Number.isSafeInteger(p.accountUserId) || p.accountUserId <= 0) throw new AccessError("social.invalidMembers", 409);
        return [p.accountUserId];
      });
      if (new Set(linkedIds).size !== linkedIds.length) throw new AccessError("social.duplicateAccount", 409);
      const accounts = await tx.user.findMany({ where: { id: { in: linkedIds }, username: { not: null } },
        select: { ...resolvedProfileFields, mergedIntoId: true } });
      if (accounts.length !== linkedIds.length) throw new AccessError("social.personNotFound", 404);
      const canonicalIds = accounts.map(account => primaryProfile(account).id);
      for (const p of body.participants) {
        const account = accounts.find(account => account.id === p.accountUserId);
        if (!account) continue;
        const canonicalId = primaryProfile(account).id;
        if (canonicalIds.filter(id => id === canonicalId).length > 1 &&
            !bill.participants.some(existing => existing.id === p.id && existing.accountUserId === p.accountUserId))
          throw new AccessError("social.duplicateAccount", 409);
      }
      const participants = body.participants.map((p: any) => {
        const originalAccount = accounts.find(a => a.id === p.accountUserId);
        if (originalAccount?.mergedIntoId && !bill.participants.some(existing => existing.id === p.id && existing.accountUserId === originalAccount.id))
          throw new AccessError("social.personNotFound", 404);
        const account = originalAccount ? primaryProfile(originalAccount) : null;
        const promptPayId = p.promptPayId == null || p.promptPayId === "" ? null : p.promptPayId;
        if (promptPayId !== null && (typeof promptPayId !== "string" || !isPromptPayId(promptPayId)))
          throw new AccessError("PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก", 409);
        return {
          id: identity(p.id),
          name: account ? (account.nickname || account.name || account.username!) : label(p.name, "participant"),
          accountUserId: originalAccount?.id ?? null,
          isPayer: p.isPayer === true,
          totalPayable: new Decimal(0),
          promptPayId,
          accountPromptPayId: participantPromptPay({ accountUser: originalAccount }),
        };
      });
      const ids = new Set<string>(participants.map((p: any) => p.id));
      if (ids.size !== participants.length)
        throw new AccessError("Duplicate participant ID", 409);
      const foreign = await tx.participant.count({
        where: { id: { in: [...ids] }, billId: { not: id } },
      });
      if (foreign) throw new AccessError("Participant belongs to another bill");
      const items = body.items.map((i: any) => {
        const restaurantId = i.restaurantId || null;
        if (restaurantId !== null && !restaurantIds.has(restaurantId))
          throw new AccessError("Invalid item restaurant", 409);
        const price = money(i.price ?? 0, "price");
        const discountRate = new Decimal(i.discountRate ?? 0);
        if (
          !discountRate.isFinite() ||
          discountRate.lt(0) ||
          discountRate.gt(100)
        )
          throw new AccessError("Invalid discount", 409);
        if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 999)
          throw new AccessError("Invalid quantity", 409);
        if (
          !Array.isArray(i.consumers) ||
          i.consumers.some(
            (c: unknown) => typeof c !== "string" || !ids.has(c),
          ) ||
          new Set(i.consumers).size !== i.consumers.length
        )
          throw new AccessError("Invalid consumers", 409);
        const cq = i.consumerQuantities ?? undefined;
        if (
          cq &&
          (typeof cq !== "object" ||
            Array.isArray(cq) ||
            Object.entries(cq).some(
              ([key, qty]) =>
                !ids.has(key) ||
                !Number.isInteger(qty) ||
                Number(qty) < 0 ||
                Number(qty) > 999,
            ))
        )
          throw new AccessError("Invalid allocation", 409);
        if (
          status === "PUBLISHED" &&
          !i.isShared &&
          !(cq
            ? Object.values(cq).some((q) => Number(q) > 0)
            : i.consumers.length)
        )
          throw new AccessError("Every item needs a consumer", 409);
        const payerId = itemPayersEnabled ? i.payerId ?? null : null;
        if (payerId !== null && !ids.has(payerId))
          throw new AccessError("คนออกเงินต้องอยู่ในบิลนี้", 409);
        if (itemPayersEnabled && status === "PUBLISHED" && !payerId)
          throw new AccessError("เลือกคนออกเงินให้ครบทุกรายการ", 409);
        return {
          restaurantId,
          payerId,
          id: typeof i.id === "string" ? i.id : "",
          name: label(i.name, "item", status === "DRAFT"),
          price,
          quantity: i.quantity,
          discountRate,
          isShared: i.isShared === true,
          includeSC: i.includeSC !== false,
          includeVat: i.includeVat !== false,
          consumers: i.consumers as string[],
          consumerQuantities: cq as Record<string, number> | undefined,
        };
      });
      const requestedPayers = body.payerCandidateIds ?? (Array.isArray(bill.payerCandidateIds)
        ? bill.payerCandidateIds.filter(id => typeof id === "string" && ids.has(id)) : []);
      if (requestedPayers !== null && requestedPayers !== undefined &&
          (!Array.isArray(requestedPayers) || requestedPayers.some(id => typeof id !== "string" || !ids.has(id)) || new Set(requestedPayers).size !== requestedPayers.length))
        throw new AccessError("Invalid bill payers", 409);
      const payerCandidateIds = requestedPayers as string[];
      const subtotal = items
        .reduce(
          (sum: Decimal, item: (typeof items)[number]) =>
            sum.plus(
              item.price
                .mul(item.quantity)
                .mul(new Decimal(1).minus(item.discountRate.div(100))),
            ),
          new Decimal(0),
        )
        .toDecimalPlaces(2);
      const sc = money(body.serviceCharge ?? 0, "service charge"),
        vat = money(body.vat ?? 0, "VAT");
      const roundingMode = body.roundingMode ?? bill.roundingMode;
      if (!["none", "up", "down"].includes(roundingMode))
        throw new AccessError("Invalid rounding mode", 409);
      const total = roundBillTotal(subtotal.plus(sc).plus(vat), roundingMode as BillRounding);
      if (
        status === "PUBLISHED" &&
        (!participants.length || !items.length || total.lte(0))
      )
        throw new AccessError("Bill is incomplete", 409);
      // Client totals are never accepted as the ledger amount.
      const result = calculateBill({
        items,
        participants,
        serviceCharge: sc,
        vat,
        grandTotal: total,
      });
      const settlement = itemPayersEnabled ? calculateSettlements({
        items, participants, serviceCharge: sc, vat, grandTotal: total,
      }) : null;
      if (itemPayersEnabled && status === "PUBLISHED" && !settlement)
        throw new AccessError("เลือกคนออกเงินและผู้ร่วมจ่ายให้ครบทุกรายการ", 409);
      if (status === "PUBLISHED" && settlement) {
        for (const p of settlement.participants.filter((p) => p.amountToReceive.gt(0))) {
          const person = participants.find((person: typeof participants[number]) => person.id === p.id);
          if (!person?.accountPromptPayId && !person?.promptPayId) {
            if (person?.accountUserId) throw new AccessError("social.accountPromptPayRequired", 409);
            throw new AccessError(`ใส่ PromptPay ของ ${p.name} เพื่อรับเงินคืน`, 409);
          }
        }
      }
      await autoFriend(tx, userId, linkedIds, "BILL");
      await tx.participant.updateMany({
        where: { billId: id },
        data: { archived: true },
      });
      for (const p of participants) {
        const gross = result.participants.find((r) => r.id === p.id)!.totalPayable;
        const balance = settlement?.participants.find((r) => r.id === p.id);
        const data = {
          name: p.name,
          accountUserId: p.accountUserId,
          promptPayId: p.promptPayId,
          isPayer: itemPayersEnabled ? items.some((i: typeof items[number]) => i.payerId === p.id) : p.isPayer,
          totalPayable: itemPayersEnabled ? (balance ? balance.amountToPay.toFixed(2) : "0.00") : gross.toFixed(2),
          shareAmount: (balance?.shareAmount ?? gross).toFixed(2),
          paidUpfront: balance?.paidUpfront.toFixed(2) ?? "0.00",
          paidAmount: "0.00",
          isPaid: false,
          archived: false,
        };
        await tx.participant.upsert({
          where: { id: p.id }, create: { id: p.id, billId: id, ...data }, update: data,
        });
      }
      await writeSettlementTransfers(tx, id, settlement);
      await tx.billItem.deleteMany({ where: { billId: id } });
      for (const item of items)
        await tx.billItem.create({
          data: {
            billId: id,
            restaurantId: item.restaurantId,
            payerId: item.payerId,
            name: item.name,
            price: item.price.toFixed(2),
            quantity: item.quantity,
            discountRate: item.discountRate.toString(),
            isShared: item.isShared,
            includeSc: item.includeSC,
            includeVat: item.includeVat,
            consumerQuantities: item.consumerQuantities,
            consumers: {
              connect: item.consumers.map((cid: string) => ({ id: cid })),
            },
          },
        });
      await tx.bill.update({
        where: { id },
        data: {
          itemPayersEnabled,
          payerCandidateIds,
          restaurants: normalizedRestaurants,
          receiptSubtotal: subtotal.toFixed(2),
          grandTotal: total.toFixed(2),
          roundingMode,
          totalDiscount: 0,
          serviceCharge: sc.toFixed(2),
          vat: vat.toFixed(2),
        },
      });
    }
    const isPublic =
      body.isPublic === undefined ? bill.isPublic : body.isPublic;
    if (typeof isPublic !== "boolean")
      throw new AccessError("Invalid visibility", 409);
    const passcode =
      body.passcode === undefined ? bill.passcode : body.passcode;
    if (passcode !== null && !isBillPin(passcode))
      throw new AccessError("PIN must have exactly 4 digits", 409);
    if (status === "PUBLISHED" && !isPublic && !passcode)
      throw new AccessError("Private bills require a PIN", 409);
    if (status === "PUBLISHED" && !editing && !["PUBLISHED", "UNSHARED"].includes(bill.status))
      throw new AccessError("Publish with complete bill data", 409);
    return tx.bill.update({
      where: { id },
      include: editorPayers,
      data: {
        version: { increment: 1 },
        status,
        isPublic,
        passcode,
        ...(body.name !== undefined
          ? { name: label(body.name, "name", status === "DRAFT") }
          : {}),
        ...(body.serviceChargeType === "%" || body.serviceChargeType === "฿"
          ? { serviceChargeType: body.serviceChargeType }
          : {}),
        ...(body.vatType === "%" || body.vatType === "฿"
          ? { vatType: body.vatType }
          : {}),
        ...(body.serviceChargeValue !== undefined
          ? {
              serviceChargeValue: money(
                body.serviceChargeValue,
                "SC input",
              ).toFixed(2),
            }
          : {}),
        ...(body.vatValue !== undefined
          ? { vatValue: money(body.vatValue, "VAT input").toFixed(2) }
          : {}),
        ...(typeof body.vatIncludesSc === "boolean"
          ? { vatIncludesSc: body.vatIncludesSc }
          : {}),
      },
    });
  });
}
