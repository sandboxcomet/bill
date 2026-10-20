import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PaymentError } from "@/lib/payment-contract";
export async function requireQuota(
  scope: string,
  maximum: number,
  seconds = 900,
) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const key = createHash("sha256").update(`${scope}:${bucket}`).digest("hex");
  const row = await prisma.requestQuota.upsert({
    where: { key },
    create: { key, expiresAt: new Date((bucket + 1) * seconds * 1000) },
    update: { count: { increment: 1 } },
  });
  if (row.count > maximum)
    throw new PaymentError("ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่", 429);
}
