"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Creates an empty DRAFT bill owned by the current user.
 * Returns the new bill's CUID — the caller handles navigation.
 */
export async function createDraftBill(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const bill = await prisma.bill.create({
    data: {
      userId: parseInt(session.user.id),
      name: "",
      receiptSubtotal: 0,
      grandTotal: 0,
      status: "DRAFT",
    },
  });

  return bill.id;
}
