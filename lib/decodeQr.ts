import jsQR from "jsqr";
import sharp from "sharp";

// Server-side QR decode fallback. Used when the client (html5-qrcode)
// fails to pick up the QR from a slip image — e.g. busy backgrounds or
// small QR relative to the full image. Returns null when no QR is found.
export async function decodeQrFromImage(
  buffer: Buffer,
): Promise<string | null> {
  const base = sharp(buffer).rotate().grayscale();
  const { width, height } = await base.metadata();
  if (!width || !height) return null;

  // Try a few scales — smaller first (faster, matches jsQR's sweet spot),
  // then larger for slips where the QR occupies a small region.
  const targetWidths = [640, 1024, 1600, Math.max(width, 2048)];
  const seen = new Set<number>();

  for (const target of targetWidths) {
    const w = Math.min(target, Math.max(width, 256));
    if (seen.has(w)) continue;
    seen.add(w);

    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: w, withoutEnlargement: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8ClampedArray(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
    const result = jsQR(pixels, info.width, info.height, {
      inversionAttempts: "attemptBoth",
    });
    if (result?.data) return result.data;
  }

  return null;
}
