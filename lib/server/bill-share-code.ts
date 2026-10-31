import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

export async function ensureBillShareCode(id: string, existing: string | null) {
  if (existing) return existing;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    try {
      const result = await prisma.bill.updateMany({ where: { id, shareCode: null }, data: { shareCode: code } });
      if (result.count) return code;
      return (await prisma.bill.findUniqueOrThrow({ where: { id }, select: { shareCode: true } })).shareCode;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
  throw new Error("Unable to allocate bill share code");
}
