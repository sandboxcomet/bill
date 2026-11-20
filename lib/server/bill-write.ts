import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { AccessError } from "./authorization";
import { calculateBill } from "@/lib/billing";
import { calculateSettlements, isPromptPayId } from "@/lib/settlements";
import { isValidPromptPayId, promptPayErrorKey } from "@/lib/promptpay";
import { writeSettlementTransfers } from "./settlement-ledger";
import { autoFriend } from "./social";
import { isBillPin } from "@/lib/pin";
import { ownsAccount, primaryProfile, resolvedProfileFields } from "./account-identity";
import { participantPromptPay, participantPromptPayFields } from "./participant-promptpay";
import { reconcileBillPayments } from "@/lib/reconcile-bill-payments";

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
      include: { participants: true, settlements: true, items: { where: { archived: false }, include: { consumers: { select: { id: true } } } } },
    });
    if (!bill || !await ownsAccount(userId, bill.userId, tx))
      throw new AccessError("Not found", 404);
    if (body.version !== bill.version)
      throw new AccessError("บิลถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดใหม่", 409);
    const refundIds = await tx.billRefund.findMany({ where: { billId: id }, select: { id: true } });
    if (refundIds.length && await tx.paymentEvidence.count({ where: {
      targetType: "refund", targetId: { in: refundIds.map(r => r.id) },
      status: { in: ["UPLOADING", "PENDING_UPLOAD", "PENDING", "NEEDS_REVIEW"] },
    } })) throw new AccessError("กรุณารอให้ตรวจสอบสลิปคืนเงินที่ค้างอยู่เสร็จก่อนแก้บิล", 409);
    const status = body.status ?? bill.status;
    const openRefunds = await tx.billRefund.findMany({ where: { billId: id }, select: { amount: true, refundedAmount: true } });
    const hasOpenRefund = openRefunds.some(r => r.refundedAmount.lt(r.amount));
    if (hasOpenRefund && bill.status === "PUBLISHED" && status !== "PUBLISHED")
      throw new AccessError("กรุณาคืนเงินที่ค้างอยู่ให้ครบก่อนหยุดแชร์หรือยกเลิกบิล", 409);
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
      const evidence = await tx.paymentEvidence.findMany({
        where: {
          status: { notIn: ["REJECTED", "SUPERSEDED"] },
          OR: [
            { targetType: "participant", targetId: { in: bill.participants.map((p) => p.id) } },
            { targetType: "settlement", targetId: { in: bill.settlements.map((s) => s.id) } },
          ],
        }, select: { status: true },
      });
      const hasPayments = evidence.length > 0 || bill.participants.some(p => p.paidAmount.gt(0) || p.isPaid);
      if (!itemPayersEnabled && bill.participants.some(p => p.isPaid && p.paidAmount.isZero()))
        throw new AccessError("บิลมีสถานะจ่ายแล้วที่ไม่ระบุยอด กรุณาตรวจสอบรายการเดิมก่อนแก้ไข", 409);
      if (hasPayments && body.revisionConfirmed !== true)
        throw new AccessError("กรุณาตรวจสอบและยืนยันผลการแก้บิลก่อนบันทึก", 409);
      if (hasPayments && status !== "PUBLISHED")
        throw new AccessError("ต้องแชร์บิลเพื่อให้ผู้เกี่ยวข้องดำเนินการคืนเงินได้", 409);
      if (hasPayments) {
        const actual = bill.itemPayersEnabled
          ? bill.settlements.filter(s => s.paidAmount.gt(0)).map(s => [s.fromParticipantId, s.toParticipantId, s.paidAmount.toFixed(2)])
          : bill.participants.filter(p => p.paidAmount.gt(0)).map(p => [p.id, "bill-owner", p.paidAmount.toFixed(2)]);
        if (!Array.isArray(body.revisionPaymentSnapshot)) throw new AccessError("กรุณาโหลดบิลใหม่เพื่อตรวจสอบยอดชำระ", 409);
        const submitted = body.revisionPaymentSnapshot.map((p: any) => {
          if (typeof p?.from !== "string" || typeof p?.to !== "string") throw new AccessError("Invalid payment snapshot", 409);
          return [p.from, p.to, money(p.amount, "paid amount").toFixed(2)];
        });
        const normalize = (rows: string[][]) => rows.map(row => JSON.stringify(row)).sort();
        if (JSON.stringify(normalize(actual)) !== JSON.stringify(normalize(submitted)))
          throw new AccessError("มียอดชำระเปลี่ยนระหว่างแก้บิล กรุณาโหลดใหม่และตรวจสอบอีกครั้ง", 409);
      }
      if (hasPayments && evidence.some(e => ["UPLOADING", "PENDING_UPLOAD", "PENDING", "NEEDS_REVIEW"].includes(e.status)))
        throw new AccessError("กรุณารอให้ตรวจสอบสลิปที่ค้างอยู่เสร็จก่อนแก้บิล", 409);
      if (hasOpenRefund)
        throw new AccessError("กรุณาคืนเงินที่ค้างอยู่ให้ครบก่อนแก้บิลอีกครั้ง", 409);
      if (hasPayments && itemPayersEnabled !== bill.itemPayersEnabled)
        throw new AccessError("ไม่สามารถเปลี่ยนรูปแบบผู้รับเงินหลังมีการจ่าย", 409);
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
        if (typeof promptPayId === "string" && !isValidPromptPayId(promptPayId) &&
          !bill.participants.some(existing => existing.id === p.id && existing.promptPayId === promptPayId) &&
          account?.promptPayId !== promptPayId)
          throw new AccessError(promptPayErrorKey(promptPayId), 409);
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
      if (hasPayments) {
        const historicalIds = new Set(bill.participants.filter(p => p.paidAmount.gt(0)).map(p => p.id));
        for (const s of bill.settlements.filter(s => s.paidAmount.gt(0))) {
          historicalIds.add(s.fromParticipantId); historicalIds.add(s.toParticipantId);
        }
        if ([...historicalIds].some(personId => !ids.has(personId)))
          throw new AccessError("ต้องเก็บผู้ที่เกี่ยวข้องกับรายการชำระไว้ในบิล", 409);
        if (bill.participants.some(old => historicalIds.has(old.id) && participants.find((p: { id: string }) => p.id === old.id)?.accountUserId !== old.accountUserId))
          throw new AccessError("ไม่สามารถเปลี่ยนบัญชีของผู้ที่มีประวัติการชำระ", 409);
        if (bill.participants.some(old => historicalIds.has(old.id) && !old.accountUserId && old.promptPayId && participants.find((p: { id: string }) => p.id === old.id)?.promptPayId !== old.promptPayId))
          throw new AccessError("ผู้ที่มีประวัติการชำระต้องยืนยันบัญชีและตั้งค่า PromptPay ของตนเอง", 409);
      }
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
      const requestedItemIds = items.map((item: { id: string }) => item.id).filter(Boolean);
      if (new Set(requestedItemIds).size !== requestedItemIds.length || requestedItemIds.some((itemId: string) => !/^[a-zA-Z0-9_-]{6,100}$/.test(itemId)))
        throw new AccessError("Invalid item IDs", 409);
      if (requestedItemIds.length && await tx.billItem.count({ where: { id: { in: requestedItemIds }, billId: { not: id } } }))
        throw new AccessError("Item belongs to another bill", 409);
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
      if (hasPayments) {
        const debts = itemPayersEnabled ? (settlement?.transfers ?? []).map(row => ({ from: row.fromParticipantId, to: row.toParticipantId, amount: row.amount }))
          : result.participants.map(row => ({ from: row.id, to: "bill-owner", amount: row.totalPayable }));
        const payments = itemPayersEnabled ? bill.settlements.filter(row => row.paidAmount.gt(0)).map(row => ({ from: row.fromParticipantId, to: row.toParticipantId, amount: row.paidAmount.toString() }))
          : bill.participants.filter(row => row.paidAmount.gt(0)).map(row => ({ from: row.id, to: "bill-owner", amount: row.paidAmount.toString() }));
        for (const row of reconcileBillPayments(debts, payments, []).filter(row => row.refundDue.gt(0))) {
          const recipient = participants.find((person: typeof participants[number]) => person.id === row.from);
          if (!recipient?.accountPromptPayId && !recipient?.promptPayId) throw new AccessError(`ใส่ PromptPay ของ ${recipient?.name ?? "ผู้รับเงินคืน"} เพื่อรับเงินคืน`, 409);
        }
      }
      if (hasPayments) {
        await tx.billRevision.create({ data: {
          billId: id, version: bill.version, actorId: userId,
          snapshot: JSON.parse(JSON.stringify(bill)),
        } });
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
          paidAmount: !itemPayersEnabled && hasPayments ? (bill.participants.find(old => old.id === p.id)?.paidAmount.toFixed(2) ?? "0.00") : "0.00",
          isPaid: false,
          archived: false,
        };
        await tx.participant.upsert({
          where: { id: p.id }, create: { id: p.id, billId: id, ...data }, update: data,
        });
      }
      await writeSettlementTransfers(tx, id, settlement, hasPayments ? bill.version + 1 : undefined);
      if (hasPayments && !itemPayersEnabled) {
        for (const old of bill.participants) {
          const updated = result.participants.find(r => r.id === old.id);
          const due = updated?.totalPayable ?? new Decimal(0);
          const excess = new Decimal(old.paidAmount.toString()).minus(due);
          if (excess.gt(0)) await tx.billRefund.create({ data: {
            billId: id, version: bill.version + 1, targetType: "participant", targetId: old.id,
            toParticipantId: old.id, amount: excess.toFixed(2),
          } });
          if (updated && old.paidAmount.gt(0)) await tx.participant.update({ where: { id: old.id }, data: { isPaid: old.paidAmount.gte(due.toFixed(2)) } });
        }
      }
      if (itemPayersEnabled) {
        for (const p of participants) {
          const outgoing = await tx.billSettlement.findMany({ where: { billId: id, fromParticipantId: p.id, archived: false } });
          const paid = outgoing.reduce((sum, s) => sum.plus(s.paidAmount), new Prisma.Decimal(0));
          await tx.participant.update({ where: { id: p.id }, data: { paidAmount: paid, isPaid: outgoing.length > 0 && outgoing.every(s => s.isPaid) } });
        }
      }
      await tx.billItem.updateMany({ where: { billId: id, archived: false, id: { notIn: requestedItemIds } }, data: { archived: true } });
      let nextItemOrder = bill.items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
      for (const item of items) {
        const data = {
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
          };
        const existing = item.id ? await tx.billItem.findFirst({ where: { id: item.id, billId: id } }) : null;
        if (existing) {
          const { billId: _billId, consumers: _consumers, ...fields } = data;
          await tx.billItem.update({ where: { id: item.id }, data: { ...fields, archived: false, consumers: { set: item.consumers.map((cid: string) => ({ id: cid })) } } });
        } else await tx.billItem.create({ data: { ...data, sortOrder: nextItemOrder++, ...(item.id ? { id: item.id } : {}) } });
      }
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
