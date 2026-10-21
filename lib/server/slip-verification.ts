import sharp from "sharp";
import { PaymentError, inspectSlip } from "@/lib/payment-contract";
export { PaymentError, inspectSlip } from "@/lib/payment-contract";
import { decodeQrFromImage } from "@/lib/decodeQr";

export class PendingSlip extends PaymentError {
  constructor(public readonly payload: string, public readonly image: Buffer) {
    super("errors.slipPending", 422);
  }
}

export async function verifySlipUpload(
  file: FormDataEntryValue | null,
  expectedReceiver: string | null,
) {
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 4 * 1024 * 1024
  ) {
    throw new PaymentError("เลือกรูปสลิปขนาดไม่เกิน 4 MB", 400);
  }
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  ) {
    throw new PaymentError("รองรับ JPG, PNG, WebP และ GIF", 400);
  }
  let image: Buffer;
  try {
    const source = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 16_000_000,
      animated: false,
    });
    const metadata = await source.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      !["jpeg", "png", "webp", "gif"].includes(metadata.format ?? "")
    )
      throw new Error("Invalid image");
    image = await source
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch {
    throw new PaymentError(
      "ไฟล์รูปภาพไม่ถูกต้องหรือมีขนาดพิกเซลเกินกำหนด",
      400,
    );
  }
  const payload = await decodeQrFromImage(image);
  if (!payload || payload.length > 128)
    throw new PaymentError("ไม่พบ QR ในรูปสลิป กรุณาใช้รูปที่ชัดเจน");
  const key = process.env.EASY_SLIP_KEY;
  if (!key) throw new PaymentError("ระบบตรวจสอบสลิปยังไม่พร้อมใช้งาน", 503);
  const response = await fetch("https://api.easyslip.com/v2/verify/bank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload, checkDuplicate: false }),
    signal: AbortSignal.timeout(20_000),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if ((result as { error?: { code?: unknown } } | null)?.error?.code === "SLIP_PENDING")
      throw new PendingSlip(payload, image);
    throw new PaymentError(
      "ผู้ให้บริการตรวจสอบสลิปยังไม่ยืนยันรายการ กรุณาลองใหม่",
      422,
    );
  }
  return { ...inspectSlip(result, expectedReceiver), image };
}
