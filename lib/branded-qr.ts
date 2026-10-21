import { create } from "qrcode/lib/core/qrcode";

// Keep the four-module quiet zone and the finder patterns' 7/5/3 proportions.
export function brandedQrSvg(value: string, logoDataUrl?: string) {
  const { modules } = create(value, { errorCorrectionLevel: "H" });
  const size = modules.size;
  const margin = 4;
  const width = size + margin * 2;
  const finders = [[0, 0], [size - 7, 0], [0, size - 7]];
  const isFinder = (x: number, y: number) => finders.some(([fx, fy]) =>
    x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const shapes: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules.get(y, x) || isFinder(x, y)) continue;
      shapes.push(`<rect x="${x + margin + 0.03}" y="${y + margin + 0.03}" width="0.94" height="0.94" rx="0.24"/>`);
    }
  }
  for (const [x, y] of finders) {
    shapes.push(`<rect x="${x + margin}" y="${y + margin}" width="7" height="7" rx="0.8"/>`);
    shapes.push(`<rect x="${x + margin + 1}" y="${y + margin + 1}" width="5" height="5" rx="0.4" fill="white"/>`);
    shapes.push(`<rect x="${x + margin + 2}" y="${y + margin + 2}" width="3" height="3" rx="0.3"/>`);
  }
  // A small central logo with white clearance; H-level correction protects its area.
  const logoSize = Math.floor(size * 0.2);
  const start = (width - logoSize) / 2;
  const logo = logoDataUrl && /^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logoDataUrl)
    ? `<rect x="${start - 0.8}" y="${start - 0.8}" width="${logoSize + 1.6}" height="${logoSize + 1.6}" rx="1.5" fill="white"/><image href="${logoDataUrl}" x="${start}" y="${start}" width="${logoSize}" height="${logoSize}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 ${width} ${width}"><rect width="${width}" height="${width}" fill="white"/><g fill="black">${shapes.join("")}</g>${logo}</svg>`;
}
