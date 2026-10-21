"use server";

import { requireUserId } from "@/lib/server/authorization";
import { prisma } from "@/lib/prisma";

/**
 * Creates an empty DRAFT bill owned by the current user.
 * Returns the new bill's CUID — the caller handles navigation.
 */
export async function createDraftBill(): Promise<string> {
  const userId = await requireUserId();

  const bill = await prisma.bill.create({
    data: {
      userId,
      name: "",
      receiptSubtotal: 0,
      grandTotal: 0,
      status: "DRAFT",
    },
  });

  return bill.id;
}
