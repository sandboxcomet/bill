import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { AccessError } from "./authorization";
import { calculateBill } from "@/lib/billing";

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
      include: { participants: true },
    });
    if (!bill || bill.userId !== userId)
      throw new AccessError("Not found", 404);
    if (body.version !== bill.version)
      throw new AccessError("บิลถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดใหม่", 409);
    const status = body.status ?? bill.status;
    if (
      !["DRAFT", "PUBLISHED", "CANCELLED"].includes(status) ||
      bill.status === "CANCELLED" ||
      (bill.status === "PUBLISHED" && status === "DRAFT")
    )
      throw new AccessError("Invalid bill transition", 409);
    const editing =
      Array.isArray(body.items) || Array.isArray(body.participants);
    if (editing) {
      const evidenceCount = await tx.paymentEvidence.count({
        where: {
          targetType: "participant",
          targetId: { in: bill.participants.map((p) => p.id) },
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
      const participants = body.participants.map((p: any) => ({
        id: identity(p.id),
        name: label(p.name, "participant"),
        isPayer: p.isPayer === true,
        totalPayable: new Decimal(0),
      }));
      const ids = new Set<string>(participants.map((p: any) => p.id));
      if (ids.size !== participants.length)
        throw new AccessError("Duplicate participant ID", 409);
      const foreign = await tx.participant.count({
        where: { id: { in: [...ids] }, billId: { not: id } },
      });
      if (foreign) throw new AccessError("Participant belongs to another bill");
      const items = body.items.map((i: any) => {
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
        return {
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
      const total = subtotal.plus(sc).plus(vat);
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
      await tx.participant.updateMany({
        where: { billId: id },
        data: { archived: true },
      });
      for (const p of participants) {
        const payable = result.participants
          .find((r) => r.id === p.id)!
          .totalPayable.toFixed(2);
        await tx.participant.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            billId: id,
            name: p.name,
            isPayer: p.isPayer,
            totalPayable: payable,
          },
          update: {
            name: p.name,
            isPayer: p.isPayer,
            totalPayable: payable,
            archived: false,
          },
        });
      }
      await tx.billItem.deleteMany({ where: { billId: id } });
      for (const item of items)
        await tx.billItem.create({
          data: {
            billId: id,
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
          receiptSubtotal: subtotal.toFixed(2),
          grandTotal: total.toFixed(2),
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
    if (passcode !== null && !/^\d{4,6}$/.test(passcode))
      throw new AccessError("PIN must have 4–6 digits", 409);
    if (status === "PUBLISHED" && !isPublic && !passcode)
      throw new AccessError("Private bills require a PIN", 409);
    if (status === "PUBLISHED" && !editing && bill.status !== "PUBLISHED")
      throw new AccessError("Publish with complete bill data", 409);
    return tx.bill.update({
      where: { id },
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
